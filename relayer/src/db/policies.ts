import type { PolicyRow, PolicyCreatedEvent, PolicyRevokedEvent } from '../types.js'
import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:policies')

/**
 * Extract plan_id and plan_merchant from a metadata URL if it matches
 * the relayer's URL pattern. Returns null for external/unrecognized URLs.
 */
function extractPlanRef(metadataUrl: string | null): { planId: string; planMerchant: string } | null {
  if (!metadataUrl) return null
  // New format: /metadata/0xABC.../pro-plan
  const newMatch = metadataUrl.match(/\/metadata\/(0x[a-fA-F0-9]{40})\/([^/?#]+)$/)
  if (newMatch) return { planMerchant: newMatch[1].toLowerCase(), planId: newMatch[2] }
  // Legacy format: /metadata/pro-plan (merchant unknown in URL)
  const legacyMatch = metadataUrl.match(/\/metadata\/([^/?#]+)$/)
  if (legacyMatch) return { planMerchant: '', planId: legacyMatch[1] }
  return null
}

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

  // Extract plan reference from metadata URL for soft FK lookups
  const planRef = extractPlanRef(event.metadataUrl || null)

  await db`
    INSERT INTO policies (
      id, chain_id, payer, merchant, charge_amount, spending_cap,
      interval_seconds, last_charged_at, next_charge_at, charge_count,
      total_spent, active, metadata_url, plan_id, plan_merchant,
      created_at, created_block, created_tx
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
      ${planRef?.planId ?? null},
      ${planRef?.planMerchant ?? null},
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

  // Read current state before updating for diagnostics
  const before = await db`
    SELECT charge_count, total_spent, spending_cap FROM policies
    WHERE id = ${policyId} AND chain_id = ${chainId}
  `
  const prev = before[0]

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

  logger.debug({
    policyId,
    chainId,
    chargeAmount: amount,
    prevChargeCount: prev?.charge_count,
    newChargeCount: prev ? prev.charge_count + 1 : '?',
    prevTotalSpent: prev?.total_spent,
    newTotalSpent: prev ? (BigInt(prev.total_spent) + BigInt(amount)).toString() : '?',
    spendingCap: prev?.spending_cap,
    nextChargeAt: nextChargeAt.toISOString(),
  }, '[CHARGE-TRACE] Updated policy after charge')
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
      FOR UPDATE SKIP LOCKED
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
    FOR UPDATE SKIP LOCKED
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

  await db`
    UPDATE policies
    SET last_failure_reason = ${reason}
    WHERE id = ${policyId} AND chain_id = ${chainId}
  `

  logger.warn({ policyId, chainId, reason }, 'Policy needs attention — hard-fail retries exhausted')
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

export async function getPoliciesByPayer(
  databaseUrl: string,
  chainId: number,
  payerAddress: string,
  active: boolean | null,
  page: number,
  limit: number
): Promise<{ policies: PolicyRow[]; total: number }> {
  const db = getDb(databaseUrl)
  const addr = payerAddress.toLowerCase()
  const offset = (page - 1) * limit

  const activeFilter = active === null
    ? db``
    : db`AND active = ${active}`

  const [policies, countResult] = await Promise.all([
    db<PolicyRow[]>`
      SELECT *
      FROM policies
      WHERE payer = ${addr}
        AND chain_id = ${chainId}
        ${activeFilter}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    db`
      SELECT count(*)::int AS total
      FROM policies
      WHERE payer = ${addr}
        AND chain_id = ${chainId}
        ${activeFilter}
    `,
  ])

  return { policies, total: countResult[0]?.total ?? 0 }
}

/**
 * Pure decision logic for `updateSpendingCap` — pulled out so we can unit-test
 * the resume-on-raise branch without standing up Postgres. Returns either:
 *   - `noop`        the policy isn't in our DB; skip.
 *   - `update-cap`  active policy, or inactive but not chargeable again → only
 *                   change `spending_cap`.
 *   - `resume`      DB-inactive policy (cap-completed) whose new cap makes it
 *                   chargeable again → reactivate and reschedule. Includes the
 *                   computed `nextChargeAt`.
 *
 * Resume-on-raise rationale: a cap-exhausted policy is `active=false` in the DB
 * but still `active=true` on chain (the contract never auto-flips it), so any
 * `SpendingCapUpdated` event for a DB-inactive row must be a completed sub
 * being resumed. Failure- or revoke-cancelled policies are inactive on chain
 * and therefore cannot emit this event in the first place.
 */
export type SpendingCapUpdateDecision =
  | { kind: 'noop' }
  | { kind: 'update-cap' }
  | { kind: 'resume'; nextChargeAt: Date }

export function decideSpendingCapUpdate(
  existing: PolicyRow | null,
  newCap: bigint
): SpendingCapUpdateDecision {
  if (!existing) return { kind: 'noop' }

  const totalSpent = BigInt(existing.total_spent)
  const chargeableAgain = newCap === 0n || newCap > totalSpent
  const shouldResume = !existing.active && !existing.cancelled_by_failure && chargeableAgain

  if (shouldResume) {
    const lastCharged = existing.last_charged_at ?? existing.created_at
    const nextChargeAt = new Date(
      new Date(lastCharged).getTime() + existing.interval_seconds * 1000
    )
    return { kind: 'resume', nextChargeAt }
  }

  return { kind: 'update-cap' }
}

/** Sync a policy's spending cap after an on-chain SpendingCapUpdated event. */
export async function updateSpendingCap(
  databaseUrl: string,
  chainId: number,
  policyId: string,
  newCap: bigint
) {
  const db = getDb(databaseUrl)
  const existing = await getPolicy(databaseUrl, chainId, policyId)
  const decision = decideSpendingCapUpdate(existing, newCap)

  switch (decision.kind) {
    case 'noop':
      logger.warn({ policyId, chainId }, 'SpendingCapUpdated for unknown policy — skipping')
      return

    case 'resume':
      await db`
        UPDATE policies
        SET spending_cap = ${newCap.toString()},
            active = true,
            ended_at = NULL,
            next_charge_at = ${decision.nextChargeAt}
        WHERE id = ${policyId} AND chain_id = ${chainId}
      `
      logger.info(
        { policyId, chainId, newCap: newCap.toString(), nextChargeAt: decision.nextChargeAt.toISOString() },
        'Spending cap raised — resuming completed policy'
      )
      return

    case 'update-cap':
      await db`
        UPDATE policies
        SET spending_cap = ${newCap.toString()}
        WHERE id = ${policyId} AND chain_id = ${chainId}
      `
      logger.debug({ policyId, chainId, newCap: newCap.toString() }, 'Spending cap updated')
      return
  }
}

export async function markPolicyCompleted(
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
      ended_at = ${timestamp}
    WHERE id = ${policyId} AND chain_id = ${chainId}
  `

  logger.info({ policyId, chainId }, 'Policy completed (spending cap reached)')
}
