import type { RelayerConfig } from '../types.js'
import { getChargesWithPendingReceipts, setChargeReceiptCid, markReceiptUploadFailed } from '../db/charges.js'
import { buildReceiptFromRow, uploadChargeReceipt, isStorachaEnabled } from '../reports/receipt.js'
import { getStorachaClient } from '../lib/storacha.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('receipt-retry')

// Retry interval: 5 minutes
const RETRY_INTERVAL_MS = 5 * 60 * 1000

/**
 * Process one batch of pending/failed receipt uploads.
 * Returns the number of receipts successfully uploaded.
 */
export async function retryPendingReceipts(config: RelayerConfig): Promise<number> {
  if (!isStorachaEnabled()) {
    return 0
  }

  // Fail fast if client can't be initialized — don't attempt N uploads individually
  try {
    await getStorachaClient()
  } catch (err) {
    logger.error({ err }, 'Storacha client initialization failed — skipping receipt retry batch')
    return 0
  }

  const pending = await getChargesWithPendingReceipts(config.databaseUrl, 20)

  if (pending.length === 0) {
    return 0
  }

  logger.info({ count: pending.length }, 'Retrying pending receipt uploads')

  let uploaded = 0

  for (const charge of pending) {
    try {
      const receipt = buildReceiptFromRow(charge)
      const cid = await uploadChargeReceipt(receipt)
      await setChargeReceiptCid(config.databaseUrl, charge.id, cid)
      uploaded++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.warn({ chargeId: charge.id, retryCount: charge.receipt_retry_count, err: message }, 'Receipt upload retry failed')
      await markReceiptUploadFailed(config.databaseUrl, charge.id, message)
    }
  }

  if (uploaded > 0) {
    logger.info({ uploaded, total: pending.length }, 'Receipt upload retry batch complete')
  }

  return uploaded
}

/**
 * Start a loop that retries pending receipt uploads every 5 minutes.
 * Sleeps first to avoid racing with the executor on startup.
 */
export async function startReceiptRetryLoop(
  config: RelayerConfig,
  signal: AbortSignal
) {
  logger.info('Starting receipt upload retry loop')

  while (!signal.aborted) {
    // Sleep first — avoids racing with the executor's first batch on startup
    await sleep(RETRY_INTERVAL_MS, signal)

    if (signal.aborted) break

    try {
      await retryPendingReceipts(config)
    } catch (error) {
      logger.error({ error }, 'Receipt retry loop error')
    }
  }

  logger.info('Receipt upload retry loop stopped')
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
