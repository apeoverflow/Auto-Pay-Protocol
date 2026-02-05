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
