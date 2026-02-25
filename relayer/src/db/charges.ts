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

export async function markChargeSuccess(
  databaseUrl: string,
  chargeId: number,
  txHash: string,
  protocolFee: string
) {
  const db = getDb(databaseUrl)

  await db`
    UPDATE charges
    SET
      status = 'success',
      tx_hash = ${txHash},
      protocol_fee = ${protocolFee},
      completed_at = NOW()
    WHERE id = ${chargeId}
  `

  logger.debug({ chargeId, txHash }, 'Marked charge as success')
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
) {
  const db = getDb(databaseUrl)

  await db`
    UPDATE charges
    SET receipt_cid = ${cid},
        receipt_upload_status = 'uploaded',
        receipt_upload_error = NULL
    WHERE id = ${chargeId}
  `

  logger.debug({ chargeId, cid }, 'Set charge receipt CID')
}

export async function markReceiptUploadPending(
  databaseUrl: string,
  chargeId: number
) {
  const db = getDb(databaseUrl)

  await db`
    UPDATE charges
    SET receipt_upload_status = 'pending',
        receipt_upload_error = NULL
    WHERE id = ${chargeId}
      AND receipt_upload_status IN ('skipped', 'failed')
  `
}

export async function markReceiptUploadFailed(
  databaseUrl: string,
  chargeId: number,
  error: string
) {
  const db = getDb(databaseUrl)

  await db`
    UPDATE charges
    SET receipt_upload_status = 'failed',
        receipt_upload_error = ${error},
        receipt_retry_count = receipt_retry_count + 1,
        receipt_last_retry_at = NOW()
    WHERE id = ${chargeId}
  `

  logger.debug({ chargeId, error }, 'Marked receipt upload as failed')
}

export interface ReceiptPendingRow {
  id: number
  policy_id: string
  chain_id: number
  tx_hash: string
  amount: string
  protocol_fee: string | null
  receipt_upload_error: string | null
  receipt_retry_count: number
  completed_at: Date | null
  // Policy fields for receipt building
  payer: string
  merchant: string
  charge_amount: string
  metadata_url: string | null
}

// Max number of receipt upload attempts before giving up permanently
const MAX_RECEIPT_RETRIES = 10

export async function getChargesWithPendingReceipts(
  databaseUrl: string,
  limit = 20
): Promise<ReceiptPendingRow[]> {
  const db = getDb(databaseUrl)

  // NOTE: Intentionally cross-chain — receipts are chain-agnostic (chainId is embedded in receipt content)
  const rows = await db<ReceiptPendingRow[]>`
    SELECT c.id, c.policy_id, c.chain_id, c.tx_hash, c.amount, c.protocol_fee,
           c.receipt_upload_error, c.receipt_retry_count, c.completed_at,
           p.payer, p.merchant, p.charge_amount, p.metadata_url
    FROM charges c
    JOIN policies p ON c.policy_id = p.id AND c.chain_id = p.chain_id
    WHERE c.receipt_upload_status IN ('pending', 'failed')
      AND c.status = 'success'
      AND c.tx_hash IS NOT NULL
      AND c.receipt_retry_count < ${MAX_RECEIPT_RETRIES}
      AND (
        c.receipt_last_retry_at IS NULL
        OR c.receipt_last_retry_at < NOW() - INTERVAL '5 minutes' * POWER(2, LEAST(c.receipt_retry_count, 8))
      )
    ORDER BY c.created_at ASC
    LIMIT ${limit}
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

export async function getChargesByMerchant(
  databaseUrl: string,
  chainId: number,
  merchantAddress: string,
  page = 1,
  limit = 50
): Promise<{ charges: MerchantChargeRow[]; total: number }> {
  const db = getDb(databaseUrl)
  const addr = merchantAddress.toLowerCase()
  const offset = (page - 1) * limit

  const [charges, countResult] = await Promise.all([
    db<MerchantChargeRow[]>`
      SELECT c.id, c.policy_id, c.chain_id, p.payer, p.merchant,
             c.amount, c.protocol_fee, c.tx_hash, c.receipt_cid,
             c.status, c.completed_at, c.created_at
      FROM charges c
      JOIN policies p ON c.policy_id = p.id AND c.chain_id = p.chain_id
      WHERE p.merchant = ${addr}
        AND c.chain_id = ${chainId}
        AND c.status = 'success'
      ORDER BY c.completed_at DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `,
    db`
      SELECT count(*)::int AS total
      FROM charges c
      JOIN policies p ON c.policy_id = p.id AND c.chain_id = p.chain_id
      WHERE p.merchant = ${addr}
        AND c.chain_id = ${chainId}
        AND c.status = 'success'
    `,
  ])

  return { charges, total: countResult[0]?.total ?? 0 }
}
