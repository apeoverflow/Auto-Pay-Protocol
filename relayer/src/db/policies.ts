import type { PolicyRow, PolicyCreatedEvent, PolicyRevokedEvent } from '../types.js'
import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:policies')

export async function insertPolicy(
  databaseUrl: string,
  chainId: number,
  event: PolicyCreatedEvent,
  timestamp: Date
) {
  const db = getDb(databaseUrl)

  // Calculate next_charge_at based on when the policy was created
  // First charge happens immediately on createPolicy, so next charge is interval after creation
  const nextChargeAt = new Date(timestamp.getTime() + event.interval * 1000)

  await db`
    INSERT INTO policies (
      id, chain_id, payer, merchant, charge_amount, spending_cap,
      interval_seconds, last_charged_at, next_charge_at, charge_count,
      total_spent, active, metadata_url, created_at, created_block, created_tx
    ) VALUES (
      ${event.policyId},
      ${chainId},
      ${event.payer.toLowerCase()},
      ${event.merchant.toLowerCase()},
      ${event.chargeAmount.toString()},
      ${event.spendingCap.toString()},
      ${event.interval},
      ${timestamp},
      ${nextChargeAt},
      ${1},
      ${event.chargeAmount.toString()},
      ${true},
      ${event.metadataUrl || null},
      ${timestamp},
      ${Number(event.blockNumber)},
      ${event.transactionHash}
    )
    ON CONFLICT (id, chain_id) DO NOTHING
  `

  logger.debug(
    { policyId: event.policyId, chainId },
    'Inserted policy'
  )
}

export async function revokePolicy(
  databaseUrl: string,
  chainId: number,
  event: PolicyRevokedEvent,
  timestamp: Date
) {
  const db = getDb(databaseUrl)

  await db`
    UPDATE policies
    SET active = false, ended_at = ${timestamp}
    WHERE id = ${event.policyId} AND chain_id = ${chainId}
  `

  logger.debug(
    { policyId: event.policyId, chainId },
    'Revoked policy'
  )
}

export async function updatePolicyAfterCharge(
  databaseUrl: string,
  chainId: number,
  policyId: string,
  amount: string,
  timestamp: Date,
  intervalSeconds: number
) {
  const db = getDb(databaseUrl)
  const nextChargeAt = new Date(timestamp.getTime() + intervalSeconds * 1000)

  await db`
    UPDATE policies
    SET
      last_charged_at = ${timestamp},
      next_charge_at = ${nextChargeAt},
      charge_count = charge_count + 1,
      total_spent = (CAST(total_spent AS NUMERIC) + ${amount})::TEXT
    WHERE id = ${policyId} AND chain_id = ${chainId}
      AND active = true
  `

  logger.debug({ policyId, chainId }, 'Updated policy after charge')
}

export async function getPoliciesDueForCharge(
  databaseUrl: string,
  chainId: number,
  limit: number,
  maxConsecutiveFailures: number = 3,
  merchantAddresses: string[] | null = null
): Promise<PolicyRow[]> {
  const db = getDb(databaseUrl)

  if (merchantAddresses && merchantAddresses.length > 0) {
    return db<PolicyRow[]>`
      SELECT *
      FROM policies
      WHERE chain_id = ${chainId}
        AND active = true
        AND consecutive_failures < ${maxConsecutiveFailures}
        AND next_charge_at <= NOW()
        AND merchant IN ${db(merchantAddresses)}
      ORDER BY next_charge_at ASC
      LIMIT ${limit}
    `
  }

  return db<PolicyRow[]>`
    SELECT *
    FROM policies
    WHERE chain_id = ${chainId}
      AND active = true
      AND consecutive_failures < ${maxConsecutiveFailures}
      AND next_charge_at <= NOW()
    ORDER BY next_charge_at ASC
    LIMIT ${limit}
  `
}

export async function getPolicy(
  databaseUrl: string,
  chainId: number,
  policyId: string
): Promise<PolicyRow | null> {
  const db = getDb(databaseUrl)

  const rows = await db<PolicyRow[]>`
    SELECT * FROM policies
    WHERE id = ${policyId} AND chain_id = ${chainId}
  `

  return rows[0] ?? null
}

export async function getPolicyByIdOnly(
  databaseUrl: string,
  policyId: string
): Promise<PolicyRow | null> {
  const db = getDb(databaseUrl)

  const rows = await db<PolicyRow[]>`
    SELECT * FROM policies
    WHERE id = ${policyId}
    LIMIT 1
  `

  return rows[0] ?? null
}

export async function pushNextChargeAt(
  databaseUrl: string,
  chainId: number,
  policyId: string,
  intervalSeconds: number
) {
  const db = getDb(databaseUrl)
  const nextChargeAt = new Date(Date.now() + intervalSeconds * 1000)

  await db`
    UPDATE policies
    SET next_charge_at = ${nextChargeAt}
    WHERE id = ${policyId} AND chain_id = ${chainId}
  `

  logger.debug({ policyId, chainId, nextChargeAt }, 'Pushed next_charge_at forward')
}

export async function markPolicyNeedsAttention(
  databaseUrl: string,
  chainId: number,
  policyId: string,
  reason: string
) {
  const db = getDb(databaseUrl)

  // For now, just log. Could add a needs_attention column later.
  logger.warn({ policyId, chainId, reason }, 'Policy needs attention')
}

export async function incrementConsecutiveFailures(
  databaseUrl: string,
  chainId: number,
  policyId: string,
  reason: string,
  intervalSeconds: number
): Promise<number> {
  const db = getDb(databaseUrl)

  // On soft-fail, the contract updates lastCharged, so we need to update next_charge_at
  // to prevent the executor from immediately retrying
  const nextChargeAt = new Date(Date.now() + intervalSeconds * 1000)

  const rows = await db<{ consecutive_failures: number }[]>`
    UPDATE policies
    SET
      consecutive_failures = consecutive_failures + 1,
      last_failure_reason = ${reason},
      last_charged_at = NOW(),
      next_charge_at = ${nextChargeAt}
    WHERE id = ${policyId} AND chain_id = ${chainId}
    RETURNING consecutive_failures
  `

  const failures = rows[0]?.consecutive_failures ?? 0
  logger.debug({ policyId, chainId, failures, reason, nextChargeAt }, 'Incremented consecutive failures')
  return failures
}

export async function resetConsecutiveFailures(
  databaseUrl: string,
  chainId: number,
  policyId: string
) {
  const db = getDb(databaseUrl)

  await db`
    UPDATE policies
    SET
      consecutive_failures = 0,
      last_failure_reason = NULL
    WHERE id = ${policyId} AND chain_id = ${chainId}
  `

  logger.debug({ policyId, chainId }, 'Reset consecutive failures')
}

export async function markPolicyCancelledByFailure(
  databaseUrl: string,
  chainId: number,
  policyId: string,
  timestamp: Date
) {
  const db = getDb(databaseUrl)

  await db`
    UPDATE policies
    SET
      active = false,
      cancelled_by_failure = true,
      cancelled_at = ${timestamp},
      ended_at = ${timestamp}
    WHERE id = ${policyId} AND chain_id = ${chainId}
  `

  logger.info({ policyId, chainId }, 'Policy cancelled by consecutive failures')
}
