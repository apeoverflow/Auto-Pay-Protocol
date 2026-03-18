import type { ChargeRow } from '../types.js'
import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:charges')

export async function createChargeRecord(
  databaseUrl: string,
  chainId: number,
  policyId: string,
  amount: string
): Promise<number> {
  const db = getDb(databaseUrl)

  const result = await db`
    INSERT INTO charges (policy_id, chain_id, status, amount)
    VALUES (${policyId}, ${chainId}, 'pending', ${amount})
    RETURNING id
  `

  const chargeId = result[0].id
  logger.debug({ chargeId, policyId, chainId }, 'Created charge record')
  return chargeId
}

/**
 * Mark a charge as successful. Returns true if updated, false if it was a
 * duplicate (already exists for this tx_hash) — in which case the charge
 * record is deleted and the caller should skip downstream work (webhooks,
 * policy updates) to avoid FK constraint errors.
 */
export async function markChargeSuccess(
  databaseUrl: string,
  chargeId: number,
  txHash: string,
  protocolFee: string
): Promise<boolean> {
  const db = getDb(databaseUrl)
  const normalizedHash = txHash.toLowerCase()

  // Check if a charge with this tx_hash already exists (duplicate from concurrent processing)
  if (await chargeExistsForTx(databaseUrl, normalizedHash)) {
    logger.warn({ chargeId, txHash: normalizedHash }, 'Duplicate charge detected, removing')
    await db`DELETE FROM charges WHERE id = ${chargeId}`
    return false
  }

  await db`
    UPDATE charges
    SET
      status = 'success',
      tx_hash = ${normalizedHash},
      protocol_fee = ${protocolFee},
      completed_at = NOW()
    WHERE id = ${chargeId}
  `

  logger.debug({ chargeId, txHash: normalizedHash }, 'Marked charge as success')
  return true
}

export async function markChargeFailed(
  databaseUrl: string,
  chargeId: number,
  errorMessage: string,
  attemptCount: number
) {
  const db = getDb(databaseUrl)

  await db`
    UPDATE charges
    SET
      status = 'failed',
      error_message = ${errorMessage},
      attempt_count = ${attemptCount},
      completed_at = NOW()
    WHERE id = ${chargeId}
  `

  logger.debug({ chargeId, errorMessage }, 'Marked charge as failed')
}

export async function deleteChargeRecord(
  databaseUrl: string,
  chargeId: number
) {
  const db = getDb(databaseUrl)

  await db`
    DELETE FROM charges WHERE id = ${chargeId}
  `

  logger.debug({ chargeId }, 'Deleted charge record')
}

export async function chargeExistsForTx(
  databaseUrl: string,
  txHash: string
): Promise<boolean> {
  const db = getDb(databaseUrl)

  const rows = await db`
    SELECT 1 FROM charges
    WHERE LOWER(tx_hash) = ${txHash.toLowerCase()} AND status = 'success'
    LIMIT 1
  `

  return rows.length > 0
}

/**
 * Check if a charge was recently handled by the executor for this policy.
 * Returns true if a charge record exists that matches the tx_hash OR
 * if there's a pending charge (executor is mid-flight).
 */
export async function chargeHandledByExecutor(
  databaseUrl: string,
  chainId: number,
  policyId: string,
  txHash: string
): Promise<boolean> {
  const db = getDb(databaseUrl)

  const rows = await db`
    SELECT 1 FROM charges
    WHERE chain_id = ${chainId}
      AND policy_id = ${policyId}
      AND (
        LOWER(tx_hash) = ${txHash.toLowerCase()}
        OR (status = 'pending' AND tx_hash IS NULL)
      )
    LIMIT 1
  `

  return rows.length > 0
}

export async function incrementChargeAttempt(
  databaseUrl: string,
  chargeId: number
) {
  const db = getDb(databaseUrl)

  await db`
    UPDATE charges
    SET attempt_count = attempt_count + 1
    WHERE id = ${chargeId}
  `
}

export async function getCharge(
  databaseUrl: string,
  chargeId: number
): Promise<ChargeRow | null> {
  const db = getDb(databaseUrl)

  const rows = await db<ChargeRow[]>`
    SELECT * FROM charges WHERE id = ${chargeId}
  `

  return rows[0] ?? null
}

export async function getPendingChargesForPolicy(
  databaseUrl: string,
  chainId: number,
  policyId: string
): Promise<ChargeRow[]> {
  const db = getDb(databaseUrl)

  const rows = await db<ChargeRow[]>`
    SELECT * FROM charges
    WHERE policy_id = ${policyId}
      AND chain_id = ${chainId}
      AND status = 'pending'
    ORDER BY created_at DESC
  `

  return rows
}

export async function getRecentChargesForPolicy(
  databaseUrl: string,
  chainId: number,
  policyId: string,
  limit = 10
): Promise<ChargeRow[]> {
  const db = getDb(databaseUrl)

  const rows = await db<ChargeRow[]>`
    SELECT * FROM charges
    WHERE policy_id = ${policyId}
      AND chain_id = ${chainId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `

  return rows
}

export async function setChargeReceiptCid(
  databaseUrl: string,
  chargeId: number,
  cid: string
): Promise<boolean> {
  const db = getDb(databaseUrl)

  const result = await db`
    UPDATE charges
    SET receipt_cid = ${cid}
    WHERE id = ${chargeId} AND receipt_cid IS NULL
    RETURNING id
  `

  const updated = result.length > 0
  logger.debug({ chargeId, cid, updated }, 'Set charge receipt CID')
  return updated
}

export interface ReceiptUploadChargeRow {
  id: number
  policy_id: string
  chain_id: number
  tx_hash: string
  amount: string
  protocol_fee: string | null
  receipt_cid: string | null
  completed_at: Date | null
  payer: string
  merchant: string
  charge_amount: string
  metadata_url: string | null
}

export async function getChargesByIdsForMerchant(
  databaseUrl: string,
  chargeIds: number[],
  merchantAddress: string,
  chainId: number
): Promise<ReceiptUploadChargeRow[]> {
  const db = getDb(databaseUrl)
  const addr = merchantAddress.toLowerCase()

  const rows = await db<ReceiptUploadChargeRow[]>`
    SELECT c.id, c.policy_id, c.chain_id, c.tx_hash, c.amount, c.protocol_fee,
           c.receipt_cid, c.completed_at,
           p.payer, p.merchant, p.charge_amount, p.metadata_url
    FROM charges c
    JOIN policies p ON c.policy_id = p.id AND c.chain_id = p.chain_id
    WHERE c.id = ANY(${chargeIds})
      AND c.chain_id = ${chainId}
      AND p.merchant = ${addr}
      AND c.status = 'success'
      AND c.tx_hash IS NOT NULL
    ORDER BY c.id ASC
  `

  return rows
}

export interface MerchantChargeRow {
  id: number
  policy_id: string
  chain_id: number
  payer: string
  merchant: string
  amount: string
  protocol_fee: string | null
  tx_hash: string | null
  receipt_cid: string | null
  status: string
  completed_at: Date | null
  created_at: Date
}

export async function getChargesByIdsForPayer(
  databaseUrl: string,
  chargeIds: number[],
  payerAddress: string,
  chainId: number
): Promise<ReceiptUploadChargeRow[]> {
  const db = getDb(databaseUrl)
  const addr = payerAddress.toLowerCase()

  const rows = await db<ReceiptUploadChargeRow[]>`
    SELECT c.id, c.policy_id, c.chain_id, c.tx_hash, c.amount, c.protocol_fee,
           c.receipt_cid, c.completed_at,
           p.payer, p.merchant, p.charge_amount, p.metadata_url
    FROM charges c
    JOIN policies p ON c.policy_id = p.id AND c.chain_id = p.chain_id
    WHERE c.id = ANY(${chargeIds})
      AND c.chain_id = ${chainId}
      AND p.payer = ${addr}
      AND c.status = 'success'
      AND c.tx_hash IS NOT NULL
    ORDER BY c.id ASC
  `

  return rows
}

export async function getChargesByMerchant(
  databaseUrl: string,
  chainId: number | undefined,
  merchantAddress: string,
  page = 1,
  limit = 50
): Promise<{ charges: MerchantChargeRow[]; total: number }> {
  const db = getDb(databaseUrl)
  const addr = merchantAddress.toLowerCase()
  const offset = (page - 1) * limit
  const chainFilter = chainId != null ? db`AND c.chain_id = ${chainId}` : db``

  const [charges, countResult] = await Promise.all([
    db<MerchantChargeRow[]>`
      SELECT c.id, c.policy_id, c.chain_id, p.payer, p.merchant,
             c.amount, c.protocol_fee, c.tx_hash, c.receipt_cid,
             c.status, c.completed_at, c.created_at
      FROM charges c
      JOIN policies p ON c.policy_id = p.id AND c.chain_id = p.chain_id
      WHERE p.merchant = ${addr}
        ${chainFilter}
        AND c.status = 'success'
      ORDER BY c.completed_at DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `,
    db`
      SELECT count(*)::int AS total
      FROM charges c
      JOIN policies p ON c.policy_id = p.id AND c.chain_id = p.chain_id
      WHERE p.merchant = ${addr}
        ${chainFilter}
        AND c.status = 'success'
    `,
  ])

  return { charges, total: countResult[0]?.total ?? 0 }
}
