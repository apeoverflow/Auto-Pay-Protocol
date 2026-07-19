import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:projections')

/**
 * Per-payer 12-month billing projection, materialised in `payer_projections`.
 *
 * Rather than deriving the delta from an individual event (fragile against
 * re-runs and against `spending_cap - total_spent` drift as charges land),
 * we recompute the payer's row from scratch whenever any of their policies
 * changes state. Per-payer active-policy counts are small (single digits in
 * practice) so this is O(1) work per event and idempotent by construction.
 *
 * Contribution per active policy:
 *   raw            = charge_amount * SECONDS_PER_YEAR / interval_seconds
 *   remaining_cap  = max(spending_cap - total_spent, 0)
 *   contribution   = min(raw, remaining_cap)
 *
 * Cap-truncation is important: a subscription that will hit its spending cap
 * in 4 months can't contribute a full year of billing. Truncating avoids
 * warning payers about approvals they'll never need.
 */

const SECONDS_PER_YEAR = 31_536_000

export interface PayerProjection {
  chainId: number
  payer: string
  projected12moMicro: bigint
  activePolicyCount: number
  updatedAt: Date
}

/**
 * Recompute a single payer's projection from the current `policies` table.
 * UPSERT — safe to call from any policy state-change handler.
 */
export async function recomputePayer(
  databaseUrl: string,
  chainId: number,
  payer: string
): Promise<{ projected12moMicro: bigint; activePolicyCount: number }> {
  const db = getDb(databaseUrl)
  const payerLower = payer.toLowerCase()

  // Single statement: aggregate from policies, upsert into projections.
  // NUMERIC math throughout — charge_amount / interval / spending_cap /
  // total_spent are all stored as text or numeric-castable.
  const [row] = await db<Array<{ projected_12mo_micro: string; active_policy_count: number }>>`
    WITH agg AS (
      SELECT
        COALESCE(SUM(
          LEAST(
            CAST(charge_amount AS NUMERIC) * ${SECONDS_PER_YEAR}::NUMERIC / GREATEST(interval_seconds, 1)::NUMERIC,
            GREATEST(CAST(spending_cap AS NUMERIC) - CAST(total_spent AS NUMERIC), 0)
          )
        ), 0)::NUMERIC AS projected_12mo_micro,
        COUNT(*)::INT AS active_policy_count
      FROM policies
      WHERE chain_id = ${chainId}
        AND payer = ${payerLower}
        AND active = true
    )
    INSERT INTO payer_projections (chain_id, payer, projected_12mo_micro, active_policy_count, updated_at)
    SELECT ${chainId}, ${payerLower}, agg.projected_12mo_micro, agg.active_policy_count, NOW() FROM agg
    ON CONFLICT (chain_id, payer) DO UPDATE
      SET projected_12mo_micro = EXCLUDED.projected_12mo_micro,
          active_policy_count = EXCLUDED.active_policy_count,
          updated_at = NOW()
    RETURNING projected_12mo_micro::TEXT AS projected_12mo_micro, active_policy_count
  `

  const result = {
    projected12moMicro: BigInt(row?.projected_12mo_micro ?? '0'),
    activePolicyCount: Number(row?.active_policy_count ?? 0),
  }

  logger.debug(
    {
      chainId,
      payer: payerLower,
      projected12moMicro: result.projected12moMicro.toString(),
      activePolicyCount: result.activePolicyCount,
    },
    'Recomputed payer projection'
  )

  return result
}

/**
 * Read a payer's projection. Returns null if the payer has never had a
 * projection materialised (e.g. no policy events indexed yet).
 */
export async function getProjection(
  databaseUrl: string,
  chainId: number,
  payer: string
): Promise<PayerProjection | null> {
  const db = getDb(databaseUrl)
  const payerLower = payer.toLowerCase()

  const rows = await db<Array<{
    chain_id: number
    payer: string
    projected_12mo_micro: string
    active_policy_count: number
    updated_at: Date
  }>>`
    SELECT chain_id, payer, projected_12mo_micro::TEXT AS projected_12mo_micro,
           active_policy_count, updated_at
    FROM payer_projections
    WHERE chain_id = ${chainId} AND payer = ${payerLower}
  `

  const row = rows[0]
  if (!row) return null

  return {
    chainId: row.chain_id,
    payer: row.payer,
    projected12moMicro: BigInt(row.projected_12mo_micro),
    activePolicyCount: row.active_policy_count,
    updatedAt: row.updated_at,
  }
}

/**
 * Recompute projections for every payer with at least one policy on this
 * chain. Used by the `projections:backfill` CLI at deploy time.
 *
 * Iterates in pages to keep memory bounded on large tables.
 */
export async function recomputeAll(
  databaseUrl: string,
  chainId: number,
  pageSize = 500
): Promise<{ payersProcessed: number }> {
  const db = getDb(databaseUrl)
  let processed = 0
  let lastPayer = ''

  while (true) {
    // DISTINCT payer, paginated by keyset on the address string.
    const rows = await db<Array<{ payer: string }>>`
      SELECT DISTINCT payer
      FROM policies
      WHERE chain_id = ${chainId} AND payer > ${lastPayer}
      ORDER BY payer ASC
      LIMIT ${pageSize}
    `
    if (rows.length === 0) break

    for (const { payer } of rows) {
      await recomputePayer(databaseUrl, chainId, payer)
      processed++
    }

    lastPayer = rows[rows.length - 1].payer
    logger.info({ chainId, processed }, 'Backfill progress')
  }

  return { payersProcessed: processed }
}

/**
 * Verification helper for the CLI: recompute a payer's projection directly
 * from `policies` without touching the materialised table, then compare
 * against `payer_projections`. Returns a diff for reporting.
 */
export async function verifyPayer(
  databaseUrl: string,
  chainId: number,
  payer: string
): Promise<{
  fromPolicies: bigint
  fromProjectionTable: bigint | null
  activePolicyCount: number
  match: boolean
}> {
  const db = getDb(databaseUrl)
  const payerLower = payer.toLowerCase()

  const [live] = await db<Array<{ projected: string; cnt: number }>>`
    SELECT
      COALESCE(SUM(
        LEAST(
          CAST(charge_amount AS NUMERIC) * ${SECONDS_PER_YEAR}::NUMERIC / GREATEST(interval_seconds, 1)::NUMERIC,
          GREATEST(CAST(spending_cap AS NUMERIC) - CAST(total_spent AS NUMERIC), 0)
        )
      ), 0)::TEXT AS projected,
      COUNT(*)::INT AS cnt
    FROM policies
    WHERE chain_id = ${chainId} AND payer = ${payerLower} AND active = true
  `

  const stored = await getProjection(databaseUrl, chainId, payerLower)
  const fromPolicies = BigInt(live?.projected ?? '0')
  const fromProjectionTable = stored?.projected12moMicro ?? null

  return {
    fromPolicies,
    fromProjectionTable,
    activePolicyCount: Number(live?.cnt ?? 0),
    match: fromProjectionTable !== null && fromProjectionTable === fromPolicies,
  }
}
