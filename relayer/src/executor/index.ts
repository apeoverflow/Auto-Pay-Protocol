import type { RelayerConfig, ChainConfig, WebhookPayload } from '../types.js'
import { chargePolicy, cancelFailedPolicyOnChain } from './charge.js'
import { shouldRetry, isRetryableError, logRetryDecision, getNextRetryDelay } from './retry.js'
import { getPoliciesDueForCharge, updatePolicyAfterCharge, markPolicyNeedsAttention, getPolicy, incrementConsecutiveFailures, resetConsecutiveFailures, markPolicyCancelledByFailure, markPolicyCompleted, pushNextChargeAt } from '../db/policies.js'
import { createChargeRecord, markChargeSuccess, markChargeFailed, incrementChargeAttempt, deleteChargeRecord, getCharge } from '../db/charges.js'
import { queueWebhook } from '../db/webhooks.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('executor')

// Process due charges for a single chain
async function processChainCharges(
  chainConfig: ChainConfig,
  config: RelayerConfig
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const merchantList = config.merchantAddresses
    ? Array.from(config.merchantAddresses)
    : null

  const duePolices = await getPoliciesDueForCharge(
    config.databaseUrl,
    chainConfig.chainId,
    config.executor.batchSize,
    config.retry.maxConsecutiveFailures,
    merchantList
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
    let result: Awaited<ReturnType<typeof chargePolicy>>
    try {
      result = await chargePolicy(policy.id, config)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unexpected executor error'
      logger.error({ policyId: policy.id, error: errorMessage }, 'chargePolicy threw unexpectedly')
      result = { success: false, policyId: policy.id, error: errorMessage }
    }

    if (result.success) {
      logger.debug({
        policyId: policy.id,
        chargeId,
        txHash: result.txHash,
        amount: result.amount,
        protocolFee: result.protocolFee,
        currentChargeCount: policy.charge_count,
        currentTotalSpent: policy.total_spent,
        spendingCap: policy.spending_cap,
      }, '[CHARGE-TRACE] Executor: charge succeeded, updating DB')

      // Update charge record — returns false if this was a duplicate (already
      // processed by a concurrent executor run). In that case the charge record
      // has been deleted, so we must NOT reference chargeId in webhooks or
      // update policy counters (would cause FK constraint error + double-count).
      const wasNew = await markChargeSuccess(
        config.databaseUrl,
        chargeId,
        result.txHash!,
        result.protocolFee ?? '0'
      )

      if (!wasNew) {
        logger.warn({
          policyId: policy.id,
          chargeId,
          txHash: result.txHash,
        }, '[CHARGE-TRACE] Duplicate charge — skipping policy update and webhook')
        succeeded++
        continue
      }

      // Update policy state — use full charge_amount (not net amount from event)
      await updatePolicyAfterCharge(
        config.databaseUrl,
        chainConfig.chainId,
        policy.id,
        policy.charge_amount,
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
    } else if (result.skipped) {
      // Timing race: DB said due but on-chain interval hasn't elapsed.
      // Clean up the charge record and move on — not an error.
      await deleteChargeRecord(config.databaseUrl, chargeId)

    } else if (result.terminal) {
      // Terminal: policy can never be charged again.
      // Dispatch based on reason for correct DB state and webhook.
      const reason = result.error ?? ''

      logger.debug({
        policyId: policy.id,
        reason,
        chargeCount: policy.charge_count,
        totalSpent: policy.total_spent,
        spendingCap: policy.spending_cap,
      }, '[CHARGE-TRACE] Policy reached terminal state, deactivating')

      await markChargeFailed(
        config.databaseUrl,
        chargeId,
        reason || 'Terminal: policy permanently unchargeable',
        1
      )

      if (reason.includes('Spending cap exceeded')) {
        // Natural completion — subscription fulfilled its full cap
        await markPolicyCompleted(
          config.databaseUrl,
          chainConfig.chainId,
          policy.id,
          new Date()
        )

        await queueWebhook(
          config.databaseUrl,
          policy.id,
          'policy.completed',
          {
            event: 'policy.completed',
            timestamp: new Date().toISOString(),
            data: {
              policyId: policy.id,
              chainId: chainConfig.chainId,
              payer: policy.payer,
              merchant: policy.merchant,
              reason,
            },
          } as WebhookPayload,
          chargeId
        )
      } else if (reason.includes('Max consecutive failures')) {
        // Already at max failures on-chain — cancel in DB and notify
        await markPolicyCancelledByFailure(
          config.databaseUrl,
          chainConfig.chainId,
          policy.id,
          new Date()
        )

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
              reason,
            },
          } as WebhookPayload,
          chargeId
        )
      } else {
        // "Policy not active" — already revoked on-chain but indexer hasn't caught up.
        // Just sync DB state. The indexer will process the revocation event with
        // the correct timestamp and queue the proper webhook.
        await markPolicyCompleted(
          config.databaseUrl,
          chainConfig.chainId,
          policy.id,
          new Date()
        )
      }

      failed++
    } else if (result.softFailed) {
      // Soft-fail: either an on-chain charge returned false (ChargeFailed event),
      // or canCharge pre-check detected insufficient balance/allowance (no tx sent).
      // In both cases, track failures in DB and advance next_charge_at.

      // Track in database and update next_charge_at to prevent immediate retry
      const failures = await incrementConsecutiveFailures(
        config.databaseUrl,
        chainConfig.chainId,
        policy.id,
        result.error ?? 'Insufficient balance or allowance',
        policy.interval_seconds
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

      // If max consecutive failures reached, cancel the policy
      if (failures >= config.retry.maxConsecutiveFailures) {
        logger.info(
          { policyId: policy.id, failures },
          'Max consecutive failures reached, cancelling policy'
        )

        // Try on-chain cancel (may fail if on-chain failures haven't reached MAX_RETRIES)
        const cancelResult = await cancelFailedPolicyOnChain(
          policy.id,
          config,
          chainConfig.chainId
        )

        if (!cancelResult.success) {
          logger.warn(
            { policyId: policy.id, error: cancelResult.error },
            'On-chain cancel failed, marking inactive in DB only'
          )
        }

        // Always mark cancelled in DB — policy is clearly dead
        await markPolicyCancelledByFailure(
          config.databaseUrl,
          chainConfig.chainId,
          policy.id,
          new Date()
        )

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

      failed++
    } else {
      // Hard failure: tx reverted or other error
      const chargeRecord = await getCharge(config.databaseUrl, chargeId)
      const attemptCount = chargeRecord?.attempt_count ?? 1
      const retryable = isRetryableError(new Error(result.error))
      const willRetry = retryable && shouldRetry(attemptCount, config.retry)

      logRetryDecision(policy.id, attemptCount, willRetry, result.error, config.retry)

      // Push next_charge_at forward using configured retry backoff (not subscription interval)
      const retryDelayMs = willRetry
        ? getNextRetryDelay(attemptCount, config.retry)
        : policy.interval_seconds * 1000 // If not retrying, use full interval
      await pushNextChargeAt(
        config.databaseUrl,
        chainConfig.chainId,
        policy.id,
        Math.ceil(retryDelayMs / 1000)
      )

      if (!willRetry) {
        // Mark charge as failed
        await markChargeFailed(
          config.databaseUrl,
          chargeId,
          result.error ?? 'Unknown error',
          attemptCount
        )

        // Mark policy as needing attention if retries exhausted
        if (attemptCount >= config.retry.maxRetries) {
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
        // Will retry - increment attempt count and record the error for debugging
        await incrementChargeAttempt(config.databaseUrl, chargeId)
        // Persist error message so failures are visible in DB even during retries
        const db = (await import('../db/index.js')).getDb(config.databaseUrl)
        await db`
          UPDATE charges SET error_message = ${result.error ?? 'Unknown error'}
          WHERE id = ${chargeId}
        `
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
