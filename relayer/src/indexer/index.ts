import type { ChainConfig, WebhookPayload } from '../types.js'
import { createChainClient, pollEvents, getBlockTimestamp, getLatestBlock } from './poller.js'
import { parseLog } from './event-parser.js'
import {
  getLastIndexedBlock,
  setLastIndexedBlock,
  initializeIndexerState,
} from '../db/indexer-state.js'
import { insertPolicy, revokePolicy, updatePolicyAfterCharge, getPolicy, markPolicyCancelledByFailure } from '../db/policies.js'
import { chargeHandledByExecutor } from '../db/charges.js'
import { queueWebhook } from '../db/webhooks.js'
import { insertSubscriberData } from '../db/subscribers.js'
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
          // Ensure subscriber_data row exists (fallback for when the checkout
          // page's fire-and-forget POST /subscribers fails or races the indexer)
          try {
            let planId: string | null = null
            let planMerchant: string | null = null
            if (parsed.event.metadataUrl) {
              try {
                const urlPath = new URL(parsed.event.metadataUrl).pathname
                const segments = urlPath.split('/').filter(Boolean)
                if (segments[0] === 'metadata' && segments.length >= 3) {
                  planMerchant = segments[1]
                  planId = segments[2]
                }
              } catch { /* invalid URL — skip plan extraction */ }
            }
            await insertSubscriberData(
              databaseUrl,
              parsed.event.policyId,
              chainConfig.chainId,
              parsed.event.payer,
              parsed.event.merchant,
              planId,
              planMerchant,
              {} // no form data available from on-chain events
            )
          } catch (err) {
            // Non-fatal — subscriber_data may already exist from checkout POST
            logger.debug({ policyId: parsed.event.policyId, err }, 'Subscriber data insert skipped (likely already exists)')
          }

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

          logger.debug({
            policyId: parsed.event.policyId,
            txHash: parsed.event.transactionHash,
            blockNumber: Number(parsed.event.blockNumber),
          }, '[CHARGE-TRACE] Indexer: saw ChargeSucceeded event')

          // Skip if the executor already processed (or is currently processing) this charge.
          // Prevents double-counting of charge_count and total_spent.
          // Checks both completed charges (by tx_hash) and in-flight charges (pending with no tx_hash).
          const alreadyProcessed = await chargeHandledByExecutor(
            databaseUrl,
            chainConfig.chainId,
            parsed.event.policyId,
            parsed.event.transactionHash
          )

          if (alreadyProcessed) {
            logger.debug({
              policyId: parsed.event.policyId,
              txHash: parsed.event.transactionHash,
            }, '[CHARGE-TRACE] Indexer: skipping — executor already handled this charge')
          } else {
            logger.debug({
              policyId: parsed.event.policyId,
              txHash: parsed.event.transactionHash,
            }, '[CHARGE-TRACE] Indexer: charge NOT found in executor records — processing as external')
            // External charge (not from our executor) or backfill — update policy state
            const existingPolicy = await getPolicy(
              databaseUrl,
              chainConfig.chainId,
              parsed.event.policyId
            )
            if (existingPolicy) {
              // Skip the first charge (emitted with PolicyCreated, already counted at insert)
              const isFirstCharge = existingPolicy.charge_count <= 1 &&
                Math.abs(timestamp.getTime() - existingPolicy.created_at.getTime()) < 60000

              if (isFirstCharge) {
                logger.debug({
                  policyId: parsed.event.policyId,
                  chargeCount: existingPolicy.charge_count,
                }, '[CHARGE-TRACE] Indexer: skipping first charge (already counted at policy creation)')
              } else {
                logger.debug({
                  policyId: parsed.event.policyId,
                  chargeCount: existingPolicy.charge_count,
                  totalSpent: existingPolicy.total_spent,
                  spendingCap: existingPolicy.spending_cap,
                }, '[CHARGE-TRACE] Indexer: external charge — updating policy state')

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
