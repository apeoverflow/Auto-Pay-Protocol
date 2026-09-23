import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:metadata')

export type SubscriberField = 'email' | 'name' | 'discord' | 'telegram' | 'twitter' | 'mobile'

export const VALID_SUBSCRIBER_FIELDS: SubscriberField[] = ['email', 'name', 'discord', 'telegram', 'twitter', 'mobile']

export interface PlanMetadata {
  version: string
  plan: {
    name: string
    description: string
    tier?: string
    features?: string[]
  }
  merchant: {
    name: string
    logo?: string
    website?: string
    supportEmail?: string
    termsUrl?: string
    privacyUrl?: string
  }
  billing?: {
    amount: string
    currency: string
    interval: string
    cap: string
  }
  display?: {
    color?: string
    badge?: string
    icon?: string
  }
  checkout?: {
    requiredFields?: SubscriberField[]
    optionalFields?: SubscriberField[]
  }
  /** Optional chains (e.g. 'tempo', 'arcTestnet') the merchant has enabled for
   *  this plan. EVM chains are always available regardless. Stored verbatim in
   *  the plan metadata JSON. */
  supportedChains?: string[]
}

export type PlanStatus = 'draft' | 'active' | 'archived'

export interface PlanMetadataRow {
  id: string
  merchant_address: string
  metadata: PlanMetadata
  ipfs_cid: string | null
  amount: string | null
  interval_label: string | null
  spending_cap: string | null
  status: PlanStatus
  created_at: Date
  updated_at: Date
  // IPFS retry-cap bookkeeping (migration 028)
  ipfs_upload_attempts: number
  ipfs_last_error: string | null
  ipfs_next_attempt_at: Date
}

/**
 * Insert a new plan. Returns false if the ID already exists (atomic collision check).
 */
export async function insertPlanMetadata(
  databaseUrl: string,
  id: string,
  merchantAddress: string,
  metadata: PlanMetadata,
  status: PlanStatus = 'active'
): Promise<boolean> {
  const db = getDb(databaseUrl)

  const amount = metadata.billing?.amount ?? null
  const intervalLabel = metadata.billing?.interval ?? null
  const spendingCap = metadata.billing?.cap ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonValue = metadata as any
  const result = await db`
    INSERT INTO plan_metadata (id, merchant_address, metadata, amount, interval_label, spending_cap, status, updated_at)
    VALUES (${id}, ${merchantAddress.toLowerCase()}, ${db.json(jsonValue)}, ${amount}, ${intervalLabel}, ${spendingCap}, ${status}, NOW())
    ON CONFLICT (id, merchant_address) DO NOTHING
    RETURNING id
  `

  if (result.length === 0) {
    logger.warn({ id }, 'Plan ID already exists, insert skipped')
    return false
  }

  logger.info({ id, merchantAddress, status }, 'Inserted plan metadata')
  return true
}

/**
 * Update an existing plan. Scopes by merchant_address to prevent ownership hijack.
 * Returns false if the plan doesn't exist or belongs to a different merchant.
 */
export async function updatePlanMetadata(
  databaseUrl: string,
  id: string,
  merchantAddress: string,
  metadata: PlanMetadata,
  status: PlanStatus
): Promise<boolean> {
  const db = getDb(databaseUrl)

  const amount = metadata.billing?.amount ?? null
  const intervalLabel = metadata.billing?.interval ?? null
  const spendingCap = metadata.billing?.cap ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonValue = metadata as any
  const result = await db`
    UPDATE plan_metadata
    SET
      metadata = ${db.json(jsonValue)},
      amount = COALESCE(${amount}, plan_metadata.amount),
      interval_label = COALESCE(${intervalLabel}, plan_metadata.interval_label),
      spending_cap = COALESCE(${spendingCap}, plan_metadata.spending_cap),
      status = ${status},
      updated_at = NOW()
    WHERE id = ${id}
      AND merchant_address = ${merchantAddress.toLowerCase()}
    RETURNING id
  `

  if (result.length === 0) {
    logger.warn({ id, merchantAddress }, 'Update failed: plan not found or wrong merchant')
    return false
  }

  logger.info({ id, merchantAddress, status }, 'Updated plan metadata')
  return true
}

/**
 * Upsert for CLI/internal use. Inserts or updates without merchant ownership guard.
 * Only use from trusted contexts (CLI, migrations).
 */
export async function upsertPlanMetadata(
  databaseUrl: string,
  id: string,
  merchantAddress: string,
  metadata: PlanMetadata,
  status: PlanStatus = 'active'
): Promise<void> {
  const db = getDb(databaseUrl)

  const amount = metadata.billing?.amount ?? null
  const intervalLabel = metadata.billing?.interval ?? null
  const spendingCap = metadata.billing?.cap ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonValue = metadata as any
  await db`
    INSERT INTO plan_metadata (id, merchant_address, metadata, amount, interval_label, spending_cap, status, updated_at)
    VALUES (${id}, ${merchantAddress.toLowerCase()}, ${db.json(jsonValue)}, ${amount}, ${intervalLabel}, ${spendingCap}, ${status}, NOW())
    ON CONFLICT (id, merchant_address) DO UPDATE
    SET
      metadata = ${db.json(jsonValue)},
      amount = COALESCE(${amount}, plan_metadata.amount),
      interval_label = COALESCE(${intervalLabel}, plan_metadata.interval_label),
      spending_cap = COALESCE(${spendingCap}, plan_metadata.spending_cap),
      status = ${status},
      updated_at = NOW()
  `

  logger.info({ id, merchantAddress, status }, 'Upserted plan metadata')
}

export async function setPlanIpfsCid(
  databaseUrl: string,
  id: string,
  merchantAddress: string,
  ipfsCid: string
): Promise<void> {
  const db = getDb(databaseUrl)

  // Success also clears the retry-cap bookkeeping: attempts reset to 0
  // and last error cleared, so a plan can recover from prior failures if
  // the merchant PATCHes its content (or if a transient provider issue
  // clears up but only after the cap was exceeded — an operator running
  // `metadata:upload-ipfs --id` manually will re-enable the retry loop).
  await db`
    UPDATE plan_metadata
    SET ipfs_cid = ${ipfsCid},
        ipfs_upload_attempts = 0,
        ipfs_last_error = NULL,
        updated_at = NOW()
    WHERE id = ${id} AND merchant_address = ${merchantAddress.toLowerCase()}
  `

  logger.info({ id, merchantAddress, ipfsCid }, 'Set plan IPFS CID')
}

/**
 * Called by handleUpdatePlan / handlePatchPlan when the merchant has
 * modified plan content and a fresh IPFS upload is required.
 *
 * NULLs the stored ipfs_cid so:
 *   (a) the response and any subsequent /metadata/... consumers see the
 *       new content only when it's ALSO been archived (no stale CID leak),
 *   (b) the ipfs-retry worker's SELECT (`WHERE ipfs_cid IS NULL`) picks
 *       the plan up if the inline upload attempt fails,
 *   (c) previous failure state (attempts, last_error) is reset so the
 *       new content gets its own fresh retry budget.
 *
 * Only clears when content has actually changed — the retry worker
 * doesn't need this to fire on every unrelated PATCH (e.g. status flip).
 */
export async function clearPlanIpfsCidForReupload(
  databaseUrl: string,
  id: string,
  merchantAddress: string
): Promise<void> {
  const db = getDb(databaseUrl)
  await db`
    UPDATE plan_metadata
    SET ipfs_cid = NULL,
        ipfs_upload_attempts = 0,
        ipfs_last_error = NULL,
        ipfs_next_attempt_at = NOW()
    WHERE id = ${id} AND merchant_address = ${merchantAddress.toLowerCase()}
  `
}

/**
 * Retry-cap bookkeeping: called by the ipfs-retry worker after each
 * failed upload. Increments attempts and schedules the next retry with
 * exponential backoff clamped to `maxBackoffMs`. Callers pass the current
 * attempt count so we don't need to re-SELECT.
 */
export async function markPlanIpfsUploadFailed(
  databaseUrl: string,
  id: string,
  merchantAddress: string,
  priorAttempts: number,
  error: string,
  baseBackoffMs = 5 * 60_000,   // 5 min → 10 min → 20 min → 40 min → 80 min → ...
  maxBackoffMs = 24 * 3600_000  // clamp at 24h
): Promise<void> {
  const db = getDb(databaseUrl)
  const nextBackoffMs = Math.min(baseBackoffMs * 2 ** priorAttempts, maxBackoffMs)
  const nextAttemptAt = new Date(Date.now() + nextBackoffMs)
  await db`
    UPDATE plan_metadata
    SET ipfs_upload_attempts = ${priorAttempts + 1},
        ipfs_last_error = ${error.slice(0, 2000)},
        ipfs_next_attempt_at = ${nextAttemptAt}
    WHERE id = ${id} AND merchant_address = ${merchantAddress.toLowerCase()}
  `
}

/**
 * Candidates for the ipfs-retry worker: active, no CID, retry time
 * reached, under the attempts cap.
 */
export async function listPlansForIpfsRetry(
  databaseUrl: string,
  maxAttempts: number,
  limit: number
): Promise<Array<PlanMetadataRow & { ipfs_upload_attempts: number }>> {
  const db = getDb(databaseUrl)
  return db<Array<PlanMetadataRow & { ipfs_upload_attempts: number }>>`
    SELECT * FROM plan_metadata
    WHERE status = 'active'
      AND ipfs_cid IS NULL
      AND ipfs_upload_attempts < ${maxAttempts}
      AND ipfs_next_attempt_at <= NOW()
    ORDER BY ipfs_next_attempt_at ASC
    LIMIT ${limit}
  `
}

export async function getPlanMetadata(
  databaseUrl: string,
  id: string,
  merchantAddress?: string
): Promise<PlanMetadataRow | null> {
  const db = getDb(databaseUrl)

  if (merchantAddress) {
    const rows = await db<PlanMetadataRow[]>`
      SELECT * FROM plan_metadata
      WHERE id = ${id} AND merchant_address = ${merchantAddress.toLowerCase()}
    `
    return rows[0] ?? null
  }

  // Unscoped lookup (legacy — returns first match)
  const rows = await db<PlanMetadataRow[]>`
    SELECT * FROM plan_metadata WHERE id = ${id} LIMIT 1
  `

  return rows[0] ?? null
}

export async function getPlanMetadataByMerchant(
  databaseUrl: string,
  merchantAddress: string,
  status?: PlanStatus
): Promise<PlanMetadataRow[]> {
  const db = getDb(databaseUrl)

  if (status) {
    const rows = await db<PlanMetadataRow[]>`
      SELECT * FROM plan_metadata
      WHERE merchant_address = ${merchantAddress.toLowerCase()}
        AND status = ${status}
      ORDER BY created_at DESC
    `
    return rows
  }

  const rows = await db<PlanMetadataRow[]>`
    SELECT * FROM plan_metadata
    WHERE merchant_address = ${merchantAddress.toLowerCase()}
    ORDER BY created_at DESC
  `

  return rows
}

export async function deletePlanMetadata(
  databaseUrl: string,
  id: string,
  merchantAddress?: string
): Promise<boolean> {
  const db = getDb(databaseUrl)

  const result = merchantAddress
    ? await db`
        DELETE FROM plan_metadata
        WHERE id = ${id} AND merchant_address = ${merchantAddress.toLowerCase()}
        RETURNING id
      `
    : await db`
        DELETE FROM plan_metadata WHERE id = ${id}
        RETURNING id
      `

  if (result.length > 0) {
    logger.info({ id, merchantAddress }, 'Deleted plan metadata')
    return true
  }

  return false
}

/**
 * List active plans that have no IPFS CID yet.
 * Optionally filter by a specific plan ID.
 */
export async function listPlansWithoutIpfsCid(
  databaseUrl: string,
  planId?: string
): Promise<PlanMetadataRow[]> {
  const db = getDb(databaseUrl)

  if (planId) {
    return db<PlanMetadataRow[]>`
      SELECT * FROM plan_metadata
      WHERE id = ${planId} AND status = 'active' AND ipfs_cid IS NULL
    `
  }

  return db<PlanMetadataRow[]>`
    SELECT * FROM plan_metadata
    WHERE status = 'active' AND ipfs_cid IS NULL
    ORDER BY created_at ASC
  `
}

export async function listAllPlanMetadata(
  databaseUrl: string
): Promise<PlanMetadataRow[]> {
  const db = getDb(databaseUrl)

  const rows = await db<PlanMetadataRow[]>`
    SELECT * FROM plan_metadata
    ORDER BY created_at DESC
  `

  return rows
}
