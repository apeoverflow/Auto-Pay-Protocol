import type { RelayerConfig, ChainConfig, WebhookPayload } from '../types.js'
import { chargePolicy, cancelFailedPolicyOnChain } from './charge.js'
import { DEFAULT_RETRY_CONFIG, shouldRetry, isRetryableError, logRetryDecision } from './retry.js'
import { getPoliciesDueForCharge, updatePolicyAfterCharge, markPolicyNeedsAttention, getPolicy, incrementConsecutiveFailures, resetConsecutiveFailures } from '../db/policies.js'
import { createChargeRecord, markChargeSuccess, markChargeFailed, incrementChargeAttempt } from '../db/charges.js'
import { queueWebhook } from '../db/webhooks.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('executor')

// Process due charges for a single chain
async function processChainCharges(
  chainConfig: ChainConfig,
  config: RelayerConfig
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const duePolices = await getPoliciesDueForCharge(
    config.databaseUrl,
    chainConfig.chainId,
    config.executor.batchSize
  )

  if (duePolices.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  logger.info(
    { chainId: chainConfig.chainId, count: duePolices.length },
    'Processing due charges'
  )

  let succeeded = 0
  let failed = 0

  for (const policy of duePolices) {
    // Create charge record
    const chargeId = await createChargeRecord(
      config.databaseUrl,
      chainConfig.chainId,
      policy.id,
      policy.charge_amount
    )

    // Attempt charge
    const result = await chargePolicy(policy.id, config)

    if (result.success) {
      // Update charge record
      await markChargeSuccess(
        config.databaseUrl,
        chargeId,
        result.txHash!,
        result.protocolFee ?? '0'
      )

      // Update policy state
      await updatePolicyAfterCharge(
        config.databaseUrl,
        chainConfig.chainId,
        policy.id,
        result.amount ?? policy.charge_amount,
        new Date(),
        policy.interval_seconds
      )

      // Reset consecutive failures on success
      await resetConsecutiveFailures(
        config.databaseUrl,
        chainConfig.chainId,
        policy.id
      )

      // Queue webhook
      await queueWebhook(
        config.databaseUrl,
        policy.id,
        'charge.succeeded',
        {
          event: 'charge.succeeded',
          timestamp: new Date().toISOString(),
          data: {
            policyId: policy.id,
            chainId: chainConfig.chainId,
            payer: policy.payer,
            merchant: policy.merchant,
            amount: result.amount ?? policy.charge_amount,
            protocolFee: result.protocolFee ?? '0',
            txHash: result.txHash,
          },
        } as WebhookPayload,
        chargeId
      )

      succeeded++
    } else if (result.softFailed) {
      // Soft-fail: tx succeeded but charge returned false (balance/allowance)
      // The contract already incremented consecutiveFailures on-chain

      // Track in database
      const failures = await incrementConsecutiveFailures(
        config.databaseUrl,
        chainConfig.chainId,
        policy.id,
        result.error ?? 'Insufficient balance or allowance'
      )

      // Mark charge as failed
      await markChargeFailed(
        config.databaseUrl,
        chargeId,
        result.error ?? 'Soft-fail: insufficient balance or allowance',
        1
      )

      // Queue charge.failed webhook
      await queueWebhook(
        config.databaseUrl,
        policy.id,
        'charge.failed',
        {
          event: 'charge.failed',
          timestamp: new Date().toISOString(),
          data: {
            policyId: policy.id,
            chainId: chainConfig.chainId,
            payer: policy.payer,
            merchant: policy.merchant,
            reason: result.error ?? 'Insufficient balance or allowance',
            txHash: result.txHash,
          },
        } as WebhookPayload,
        chargeId
      )

      // If 3+ consecutive failures, call cancelFailedPolicy on-chain
      if (failures >= DEFAULT_RETRY_CONFIG.maxRetries) {
        logger.info(
          { policyId: policy.id, failures },
          'Max consecutive failures reached, cancelling policy on-chain'
        )
        const cancelResult = await cancelFailedPolicyOnChain(
          policy.id,
          config,
          chainConfig.chainId
        )
        if (cancelResult.success) {
          // Queue cancellation webhook
          await queueWebhook(
            config.databaseUrl,
            policy.id,
            'policy.cancelled_by_failure',
            {
              event: 'policy.cancelled_by_failure',
              timestamp: new Date().toISOString(),
              data: {
                policyId: policy.id,
                chainId: chainConfig.chainId,
                payer: policy.payer,
                merchant: policy.merchant,
                txHash: cancelResult.txHash,
              },
            } as WebhookPayload,
            chargeId
          )
        }
      }

      failed++
    } else {
      // Hard failure: tx reverted or other error
      const attemptCount = policy.charge_count ?? 1
      const retryable = isRetryableError(new Error(result.error))
      const willRetry = retryable && shouldRetry(attemptCount, DEFAULT_RETRY_CONFIG)

      logRetryDecision(policy.id, attemptCount, willRetry, result.error, DEFAULT_RETRY_CONFIG)

      if (!willRetry) {
        // Mark charge as failed
        await markChargeFailed(
          config.databaseUrl,
          chargeId,
          result.error ?? 'Unknown error',
          attemptCount
        )

        // Mark policy as needing attention if retries exhausted
        if (attemptCount >= DEFAULT_RETRY_CONFIG.maxRetries) {
          await markPolicyNeedsAttention(
            config.databaseUrl,
            chainConfig.chainId,
            policy.id,
            result.error ?? 'Max retries exhausted'
          )
        }

        // Queue failure webhook
        await queueWebhook(
          config.databaseUrl,
          policy.id,
          'charge.failed',
          {
            event: 'charge.failed',
            timestamp: new Date().toISOString(),
            data: {
              policyId: policy.id,
              chainId: chainConfig.chainId,
              payer: policy.payer,
              merchant: policy.merchant,
              reason: result.error ?? 'Unknown error',
            },
          } as WebhookPayload,
          chargeId
        )

        failed++
      } else {
        // Will retry - increment attempt count
        await incrementChargeAttempt(config.databaseUrl, chargeId)
        // Don't count as failed yet - will retry on next executor run
      }
    }
  }

  return { processed: duePolices.length, succeeded, failed }
}

// Run executor once for all chains
export async function runExecutorOnce(config: RelayerConfig) {
  const enabledChains = Object.values(config.chains).filter((c) => c.enabled)

  let totalProcessed = 0
  let totalSucceeded = 0
  let totalFailed = 0

  for (const chainConfig of enabledChains) {
    try {
      const result = await processChainCharges(chainConfig, config)
      totalProcessed += result.processed
      totalSucceeded += result.succeeded
      totalFailed += result.failed
    } catch (error) {
      logger.error(
        { chainId: chainConfig.chainId, error },
        'Error processing chain charges'
      )
    }
  }

  if (totalProcessed > 0) {
    logger.info(
      { totalProcessed, totalSucceeded, totalFailed },
      'Executor run complete'
    )
  }

  return { totalProcessed, totalSucceeded, totalFailed }
}

// Start executor loop
export async function startExecutorLoop(
  config: RelayerConfig,
  signal: AbortSignal
) {
  logger.info({ runIntervalMs: config.executor.runIntervalMs }, 'Starting executor loop')

  while (!signal.aborted) {
    try {
      await runExecutorOnce(config)
    } catch (error) {
      logger.error({ error }, 'Executor error')
    }

    // Wait for next run
    await sleep(config.executor.runIntervalMs, signal)
  }

  logger.info('Executor loop stopped')
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const timeout = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout)
      resolve()
    }, { once: true })
  })
}
