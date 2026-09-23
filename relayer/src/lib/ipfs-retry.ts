import type { RelayerConfig } from '../types.js'
import { isIpfsEnabled } from './ipfs.js'
import { listPlansForIpfsRetry, markPlanIpfsUploadFailed } from '../db/metadata.js'
import { uploadPlanToIPFS } from './ipfs-upload.js'
import { getLogoStorage } from './logo-storage.js'
import { createLogger } from '../utils/logger.js'
import { sleep } from '../utils/sleep.js'

const logger = createLogger('ipfs-retry')

// Failure cap: after this many failed uploads, we stop retrying the
// plan automatically. A permanently un-pinnable plan (payload too big,
// malformed content, quota exhausted) will hit this cap after ~a day of
// exponential backoff attempts and stop hammering Pinata + our logs.
// An operator can re-enable retries by running `metadata:upload-ipfs
// --id <planId>` manually, or the merchant PATCHing the plan will reset
// attempts on the next successful upload (see setPlanIpfsCid).
const DEFAULT_MAX_ATTEMPTS = 8
const DEFAULT_BATCH = 50

/**
 * Background worker that mops up plans marked `active` but whose IPFS
 * upload failed at create/update time (retained as `ipfs_cid = NULL`).
 *
 * Non-blocking POST /merchants/:address/plans + PATCH now succeed even
 * when the IPFS provider is unreachable — the archival step is
 * best-effort. This loop provides the eventual-consistency layer.
 *
 * Failure model:
 *   • Success → setPlanIpfsCid clears attempts + last_error to 0.
 *   • Failure → markPlanIpfsUploadFailed increments attempts and
 *     schedules the next retry with exponential backoff (5min → 24h
 *     clamp). After DEFAULT_MAX_ATTEMPTS the plan drops out of the
 *     retry SELECT and requires operator intervention (or a merchant
 *     PATCH) to resume.
 *
 * Feature-flagged: no-op when isIpfsEnabled() returns false OR when
 * IPFS_RETRY_ENABLED=false.
 */
export async function runIpfsRetryOnce(config: RelayerConfig): Promise<{
  attempted: number; succeeded: number; failed: number
}> {
  if (!isIpfsEnabled()) return { attempted: 0, succeeded: 0, failed: 0 }

  const maxAttempts = parseInt(process.env.IPFS_MAX_UPLOAD_ATTEMPTS ?? String(DEFAULT_MAX_ATTEMPTS), 10)
  const plans = await listPlansForIpfsRetry(config.databaseUrl, maxAttempts, DEFAULT_BATCH)
  if (plans.length === 0) return { attempted: 0, succeeded: 0, failed: 0 }

  const storage = getLogoStorage()
  const resolver = (filename: string) => storage.publicUrl(filename)
  let succeeded = 0
  let failed = 0

  for (const plan of plans) {
    try {
      await uploadPlanToIPFS(config.databaseUrl, plan.id, plan.merchant_address, plan.metadata, resolver)
      succeeded++
    } catch (err) {
      failed++
      const errMsg = err instanceof Error ? err.message : String(err)
      try {
        await markPlanIpfsUploadFailed(
          config.databaseUrl, plan.id, plan.merchant_address,
          plan.ipfs_upload_attempts, errMsg
        )
      } catch (bookkeepingErr) {
        // Don't let a bookkeeping failure mask the primary failure — log and
        // move on. The plan will be re-attempted next tick (with old
        // next_attempt_at), which is a minor thrash but recoverable.
        logger.error({ planId: plan.id, err: bookkeepingErr }, 'Failed to record IPFS retry state')
      }
      const attemptsAfter = plan.ipfs_upload_attempts + 1
      if (attemptsAfter >= maxAttempts) {
        logger.error(
          { planId: plan.id, merchant: plan.merchant_address, attemptsAfter, maxAttempts, err: errMsg },
          'IPFS retry exhausted attempts cap — plan will no longer be auto-retried until reset via CLI or plan PATCH'
        )
      } else {
        logger.warn(
          { planId: plan.id, merchant: plan.merchant_address, attemptsAfter, maxAttempts, err: errMsg },
          'IPFS retry failed; scheduled for exponential-backoff retry'
        )
      }
    }
  }

  logger.info({ attempted: plans.length, succeeded, failed }, 'IPFS retry tick complete')
  return { attempted: plans.length, succeeded, failed }
}

export async function startIpfsRetryLoop(
  config: RelayerConfig,
  signal: AbortSignal
): Promise<void> {
  const enabled = (process.env.IPFS_RETRY_ENABLED ?? 'true').toLowerCase() !== 'false'
  if (!enabled) {
    logger.info('IPFS retry loop disabled (IPFS_RETRY_ENABLED=false)')
    return
  }
  if (!isIpfsEnabled()) {
    logger.info('IPFS retry loop skipped — provider not configured')
    return
  }

  const intervalMs = parseInt(process.env.IPFS_RETRY_INTERVAL_MS ?? '300000', 10) // 5 min default
  logger.info({ intervalMs }, 'Starting IPFS retry loop')

  while (!signal.aborted) {
    try {
      await runIpfsRetryOnce(config)
    } catch (err) {
      logger.error({ err }, 'IPFS retry tick threw unexpectedly')
    }
    await sleep(intervalMs, signal)
  }

  logger.info('IPFS retry loop stopped')
}
