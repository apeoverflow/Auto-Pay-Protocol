import type { ChainConfig, WebhookPayload } from '../types.js'
import { createChainClient, pollEvents, getBlockTimestamp, getLatestBlock } from './poller.js'
import { parseLog } from './event-parser.js'
import {
  getLastIndexedBlock,
  setLastIndexedBlock,
  initializeIndexerState,
} from '../db/indexer-state.js'
import { insertPolicy, revokePolicy, updatePolicyAfterCharge, getPolicy, markPolicyCancelledByFailure } from '../db/policies.js'
import { queueWebhook } from '../db/webhooks.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('indexer')

// Run indexer once for a chain
export async function runIndexerOnce(
  chainConfig: ChainConfig,
  databaseUrl: string,
  merchantAddresses: Set<string> | null,
  startBlock?: number
) {
  const client = createChainClient(chainConfig)

  // Get or initialize start block
  let fromBlock: bigint
  if (startBlock !== undefined) {
    fromBlock = BigInt(startBlock)
  } else {
    const lastIndexed = await getLastIndexedBlock(databaseUrl, chainConfig.chainId)
    if (lastIndexed === null) {
      await initializeIndexerState(
        databaseUrl,
        chainConfig.chainId,
        chainConfig.startBlock
      )
      fromBlock = BigInt(chainConfig.startBlock)
    } else {
      fromBlock = BigInt(lastIndexed + 1)
    }
  }

  const latestBlock = await getLatestBlock(client)
  const safeBlock = latestBlock - BigInt(chainConfig.confirmations)

  if (fromBlock > safeBlock) {
    logger.info(
      { chainId: chainConfig.chainId, fromBlock: Number(fromBlock), safeBlock: Number(safeBlock) },
      'Already up to date'
    )
    return
  }

  logger.info(
    {
      chainId: chainConfig.chainId,
      fromBlock: Number(fromBlock),
      toBlock: Number(safeBlock),
      blocks: Number(safeBlock - fromBlock + 1n),
    },
    'Starting indexer run'
  )

  const isMerchantMatch = (merchant: string): boolean => {
    if (!merchantAddresses) return true
    return merchantAddresses.has(merchant.toLowerCase())
  }

  let eventsProcessed = 0

  for await (const { logs, fromBlock: batchFrom, toBlock: batchTo } of pollEvents(
    client,
    chainConfig.policyManagerAddress,
    fromBlock,
    chainConfig.batchSize
  )) {
    // Don't process beyond safe block
    if (batchFrom > safeBlock) break

    const effectiveToBlock = batchTo > safeBlock ? safeBlock : batchTo

    for (const log of logs) {
      if (log.blockNumber! > safeBlock) continue

      const parsed = parseLog(log)
      if (!parsed) continue

      const timestamp = await getBlockTimestamp(client, log.blockNumber!)

      switch (parsed.type) {
        case 'PolicyCreated':
          if (!isMerchantMatch(parsed.event.merchant)) break
          await insertPolicy(
            databaseUrl,
            chainConfig.chainId,
            parsed.event,
            timestamp
          )
          // Queue webhook
          await queueWebhook(databaseUrl, parsed.event.policyId, 'policy.created', {
            event: 'policy.created',
            timestamp: timestamp.toISOString(),
            data: {
              policyId: parsed.event.policyId,
              chainId: chainConfig.chainId,
              payer: parsed.event.payer,
              merchant: parsed.event.merchant,
              chargeAmount: parsed.event.chargeAmount.toString(),
              interval: parsed.event.interval,
              spendingCap: parsed.event.spendingCap.toString(),
              metadataUrl: parsed.event.metadataUrl,
            },
          } as WebhookPayload)
          eventsProcessed++
          break

        case 'PolicyRevoked':
          if (!isMerchantMatch(parsed.event.merchant)) break
          await revokePolicy(
            databaseUrl,
            chainConfig.chainId,
            parsed.event,
            timestamp
          )
          // Queue webhook
          await queueWebhook(databaseUrl, parsed.event.policyId, 'policy.revoked', {
            event: 'policy.revoked',
            timestamp: timestamp.toISOString(),
            data: {
              policyId: parsed.event.policyId,
              chainId: chainConfig.chainId,
              payer: parsed.event.payer,
              merchant: parsed.event.merchant,
              endTime: parsed.event.endTime,
            },
          } as WebhookPayload)
          eventsProcessed++
          break

        case 'ChargeSucceeded':
          if (!isMerchantMatch(parsed.event.merchant)) break
          // Update policy state - but only if this isn't the first charge
          // (first charge is already counted when PolicyCreated is processed)
          const existingPolicy = await getPolicy(
            databaseUrl,
            chainConfig.chainId,
            parsed.event.policyId
          )
          if (existingPolicy && existingPolicy.charge_count > 0) {
            // Check if this charge was already processed (idempotency)
            // The first charge happens in createPolicy, so charge_count starts at 1
            // Only update if this is a subsequent charge
            const expectedChargeTime = new Date(
              existingPolicy.last_charged_at!.getTime() + existingPolicy.interval_seconds * 1000
            )
            // If the event timestamp is close to or after expected charge time, it's a new charge
            if (timestamp >= expectedChargeTime || existingPolicy.charge_count === 1) {
              // Skip if this is likely the first charge (emitted with PolicyCreated)
              // We detect this by checking if charge_count is 1 and the timestamps are very close
              const policyCreatedAt = existingPolicy.created_at.getTime()
              const eventTime = timestamp.getTime()
              const isFirstCharge = existingPolicy.charge_count === 1 &&
                Math.abs(eventTime - policyCreatedAt) < 60000 // Within 1 minute of creation

              if (!isFirstCharge) {
                await updatePolicyAfterCharge(
                  databaseUrl,
                  chainConfig.chainId,
                  parsed.event.policyId,
                  existingPolicy.charge_amount,
                  timestamp,
                  existingPolicy.interval_seconds
                )
              }
            }
          }
          // Webhook is queued by executor, not indexer (for our own charges)
          eventsProcessed++
          break

        case 'ChargeFailed':
          logger.warn(
            { policyId: parsed.event.policyId, reason: parsed.event.reason },
            'Charge failed event indexed'
          )
          eventsProcessed++
          break

        case 'PolicyCancelledByFailure':
          if (!isMerchantMatch(parsed.event.merchant)) break
          await markPolicyCancelledByFailure(
            databaseUrl,
            chainConfig.chainId,
            parsed.event.policyId,
            timestamp
          )
          // Queue webhook
          await queueWebhook(databaseUrl, parsed.event.policyId, 'policy.cancelled_by_failure', {
            event: 'policy.cancelled_by_failure',
            timestamp: timestamp.toISOString(),
            data: {
              policyId: parsed.event.policyId,
              chainId: chainConfig.chainId,
              payer: parsed.event.payer,
              merchant: parsed.event.merchant,
              endTime: parsed.event.endTime,
            },
          } as WebhookPayload)
          eventsProcessed++
          break
      }
    }

    // Update checkpoint after each batch
    await setLastIndexedBlock(databaseUrl, chainConfig.chainId, Number(effectiveToBlock))

    logger.debug(
      {
        fromBlock: Number(batchFrom),
        toBlock: Number(effectiveToBlock),
        logsProcessed: logs.filter((l) => l.blockNumber! <= safeBlock).length,
      },
      'Processed batch'
    )
  }

  logger.info(
    { chainId: chainConfig.chainId, eventsProcessed },
    'Indexer run complete'
  )
}

// Backfill events from a specific block
export async function backfillEvents(
  chainConfig: ChainConfig,
  databaseUrl: string,
  merchantAddresses: Set<string> | null,
  fromBlock: number
) {
  // Reset indexer state to the specified block
  await setLastIndexedBlock(databaseUrl, chainConfig.chainId, fromBlock - 1)

  // Run indexer from that point
  await runIndexerOnce(chainConfig, databaseUrl, merchantAddresses, fromBlock)
}

// Start continuous indexer loop
export async function startIndexerLoop(
  chainConfig: ChainConfig,
  databaseUrl: string,
  merchantAddresses: Set<string> | null,
  pollIntervalMs: number,
  signal: AbortSignal
) {
  logger.info(
    { chainId: chainConfig.chainId, pollIntervalMs },
    'Starting indexer loop'
  )

  while (!signal.aborted) {
    try {
      await runIndexerOnce(chainConfig, databaseUrl, merchantAddresses)
    } catch (error) {
      logger.error(
        { chainId: chainConfig.chainId, error },
        'Indexer error'
      )
    }

    // Wait for next poll
    await sleep(pollIntervalMs, signal)
  }

  logger.info({ chainId: chainConfig.chainId }, 'Indexer loop stopped')
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
