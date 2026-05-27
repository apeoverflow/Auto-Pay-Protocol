import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:points')

// Constants used by the points worker (exported for use in worker.ts)
// Set to 0 for now to allow all intervals — tighten to 86400 (24h) when gaming becomes a real concern
export const MIN_INTERVAL_SECONDS = 0
export const MIN_CHARGE_AMOUNT = '0' // Set to '1000000' (1 USDC) to block dust — 0 for now to capture all activity

// ── Types ────────────────────────────────────────────────────

export interface PointsAction {
  action_id: string
  display_name: string
  description: string
  points: number | null
  points_per_usdc: number | null
  category: string
  frequency: string
  frequency_cap: number
  cooldown_seconds: number
  source_type: string
  min_charge_amount: string
  enabled: boolean
}

export interface PointsEvent {
  action_id: string
  wallet: string
  points: number
  usdc_amount: number | null
  chain_id: number | null
  source_type: string
  source_ref: string
  idempotency_key: string
  metadata?: Record<string, unknown>
}

export interface PointsBalance {
  wallet: string
  total_points: number
  total_usdc_volume: number
  monthly_points: number
  weekly_points: number
  current_streak: number
  longest_streak: number
  tier: string
  leaderboard_eligible: boolean
  last_active_at: Date | null
}

export interface LeaderboardEntry {
  wallet: string
  points: number
  total_usdc_volume: number
  tier: string
  current_streak: number
  rank: number
}

export interface WorkerState {
  last_processed_charge_id: number
  last_processed_policy_created_at: Date
  last_processed_terms_at: Date
  last_loyalty_check_at: Date
}

// ── Worker State ─────────────────────────────────────────────

export async function getWorkerState(databaseUrl: string): Promise<WorkerState> {
  const db = getDb(databaseUrl)
  const rows = await db`SELECT * FROM points_worker_state WHERE id = 1`
  return rows[0] as WorkerState
}

export async function updateWorkerState(
  databaseUrl: string,
  updates: Partial<WorkerState>
) {
  const db = getDb(databaseUrl)

  await db`
    UPDATE points_worker_state SET
      last_processed_charge_id = COALESCE(${updates.last_processed_charge_id ?? null}, last_processed_charge_id),
      last_processed_policy_created_at = COALESCE(${updates.last_processed_policy_created_at ?? null}, last_processed_policy_created_at),
      last_processed_terms_at = COALESCE(${updates.last_processed_terms_at ?? null}, last_processed_terms_at),
      last_loyalty_check_at = COALESCE(${updates.last_loyalty_check_at ?? null}, last_loyalty_check_at),
      last_run_at = NOW()
    WHERE id = 1
  `
}

// ── Points Events ────────────────────────────────────────────

/**
 * Award points. Uses ON CONFLICT DO NOTHING for idempotency.
 * Returns true if the event was inserted (new), false if duplicate.
 */
export async function awardPoints(
  databaseUrl: string,
  event: PointsEvent
): Promise<boolean> {
  const db = getDb(databaseUrl)

  const result = await db`
    INSERT INTO points_events (action_id, wallet, points, usdc_amount, chain_id, source_type, source_ref, idempotency_key, metadata)
    VALUES (
      ${event.action_id},
      ${event.wallet.toLowerCase()},
      ${event.points},
      ${event.usdc_amount},
      ${event.chain_id},
      ${event.source_type},
      ${event.source_ref},
      ${event.idempotency_key},
      ${JSON.stringify(event.metadata || {})}
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id
  `

  if (result.length === 0) return false

  // Atomically update balance
  await updateBalance(databaseUrl, event.wallet.toLowerCase(), event.points, event.usdc_amount, event.source_type)

  logger.debug({
    action: event.action_id,
    wallet: event.wallet,
    points: event.points,
  }, 'Points awarded')

  return true
}

/**
 * Atomic balance update — single UPDATE with CASE expressions.
 * PostgreSQL row-level lock prevents race conditions at month/week boundaries.
 */
async function updateBalance(
  databaseUrl: string,
  wallet: string,
  points: number,
  usdcAmount: number | null,
  sourceType: string
) {
  const db = getDb(databaseUrl)
  const vol = usdcAmount ?? 0

  // Try UPDATE first
  const updated = await db`
    UPDATE points_balances SET
      total_points = total_points + ${points},
      total_usdc_volume = total_usdc_volume + ${vol},
      monthly_points = CASE
        WHEN month_key = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM') THEN monthly_points + ${points}
        ELSE ${points}
      END,
      weekly_points = CASE
        WHEN week_key = to_char(NOW() AT TIME ZONE 'UTC', 'IYYY-"W"IW') THEN weekly_points + ${points}
        ELSE ${points}
      END,
      month_key = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM'),
      week_key = to_char(NOW() AT TIME ZONE 'UTC', 'IYYY-"W"IW'),
      tier = CASE
        WHEN total_points + ${points} >= 50000 THEN 'diamond'
        WHEN total_points + ${points} >= 10000 THEN 'gold'
        WHEN total_points + ${points} >= 2500 THEN 'silver'
        ELSE 'bronze'
      END,
      leaderboard_eligible = CASE
        WHEN ${sourceType} = 'on-chain' THEN true
        ELSE leaderboard_eligible
      END,
      last_active_at = NOW(),
      updated_at = NOW()
    WHERE wallet = ${wallet}
    RETURNING wallet
  `

  // If no row existed, INSERT
  if (updated.length === 0) {
    const tier = points >= 50000 ? 'diamond' : points >= 10000 ? 'gold' : points >= 2500 ? 'silver' : 'bronze'
    await db`
      INSERT INTO points_balances (wallet, total_points, total_usdc_volume, monthly_points, weekly_points, month_key, week_key, tier, leaderboard_eligible, last_active_at, updated_at)
      VALUES (
        ${wallet}, ${points}, ${vol}, ${points}, ${points},
        to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM'),
        to_char(NOW() AT TIME ZONE 'UTC', 'IYYY-"W"IW'),
        ${tier},
        ${sourceType === 'on-chain'},
        NOW(), NOW()
      )
      ON CONFLICT (wallet) DO UPDATE SET
        total_points = points_balances.total_points + ${points},
        total_usdc_volume = points_balances.total_usdc_volume + ${vol},
        last_active_at = NOW(),
        updated_at = NOW()
    `
  }
}

// ── Streak tracking ──────────────────────────────────────────

export async function updateStreak(databaseUrl: string, wallet: string): Promise<number> {
  const db = getDb(databaseUrl)
  const w = wallet.toLowerCase()

  const rows = await db`SELECT current_streak, longest_streak, last_checkin_date FROM points_balances WHERE wallet = ${w}`
  if (rows.length === 0) return 0

  const { current_streak, longest_streak, last_checkin_date } = rows[0] as any
  const today = new Date().toISOString().slice(0, 10)

  if (last_checkin_date === today) return current_streak // already checked in today

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const lastDate = last_checkin_date ? new Date(last_checkin_date).toISOString().slice(0, 10) : null

  const newStreak = lastDate === yesterday ? current_streak + 1 : 1
  const newLongest = Math.max(longest_streak, newStreak)

  await db`
    UPDATE points_balances SET
      current_streak = ${newStreak},
      longest_streak = ${newLongest},
      last_checkin_date = ${today}
    WHERE wallet = ${w}
  `

  return newStreak
}

// ── Query helpers for worker ─────────────────────────────────

export async function getNewCharges(databaseUrl: string, afterId: number) {
  const db = getDb(databaseUrl)
  return db`
    SELECT c.id, c.policy_id, c.chain_id, c.amount, c.tx_hash,
           p.payer, p.merchant, p.charge_amount, p.interval_seconds
    FROM charges c
    JOIN policies p ON c.policy_id = p.id AND c.chain_id = p.chain_id
    WHERE c.id > ${afterId} AND c.status = 'success'
    ORDER BY c.id ASC
    LIMIT 500
  `
}

export async function getNewPolicies(databaseUrl: string, afterDate: Date) {
  const db = getDb(databaseUrl)
  return db`
    SELECT id, chain_id, payer, merchant, charge_amount, interval_seconds, created_at, created_tx
    FROM policies
    WHERE created_at > ${afterDate} AND payer != merchant
    ORDER BY created_at ASC
    LIMIT 500
  `
}

export async function getNewTermsAcceptances(databaseUrl: string, afterDate: Date) {
  const db = getDb(databaseUrl)
  return db`
    SELECT wallet_address, accepted_at
    FROM terms_acceptances
    WHERE accepted_at > ${afterDate}
    ORDER BY accepted_at ASC
    LIMIT 500
  `
}

export async function countUniquePayerMerchants(databaseUrl: string, payer: string): Promise<number> {
  const db = getDb(databaseUrl)
  const rows = await db`
    SELECT COUNT(DISTINCT merchant) as cnt
    FROM policies
    WHERE payer = ${payer.toLowerCase()} AND payer != merchant
  `
  return Number(rows[0].cnt)
}

export async function countUniqueMerchantPayers(databaseUrl: string, merchant: string): Promise<number> {
  const db = getDb(databaseUrl)
  const rows = await db`
    SELECT COUNT(DISTINCT payer) as cnt
    FROM policies
    WHERE merchant = ${merchant.toLowerCase()} AND payer != merchant AND active = true
  `
  return Number(rows[0].cnt)
}

export async function getActivePoliciesForLoyalty(databaseUrl: string) {
  const db = getDb(databaseUrl)
  return db`
    SELECT id, chain_id, payer, merchant, created_at, charge_count, interval_seconds
    FROM policies
    WHERE active = true AND payer != merchant
    ORDER BY created_at ASC
  `
}

export async function countSuccessfulChargesForPayer(databaseUrl: string, payer: string, chainId: number): Promise<number> {
  const db = getDb(databaseUrl)
  const rows = await db`
    SELECT COUNT(*) as cnt FROM charges
    WHERE policy_id IN (SELECT id FROM policies WHERE payer = ${payer.toLowerCase()} AND chain_id = ${chainId})
      AND status = 'success'
  `
  return Number(rows[0].cnt)
}

export async function getPendingReferral(databaseUrl: string, referred: string) {
  const db = getDb(databaseUrl)
  const rows = await db`
    SELECT r.*, rc.wallet as referrer_wallet
    FROM referrals r
    JOIN referral_codes rc ON r.referral_code = rc.code
    WHERE r.referred = ${referred.toLowerCase()} AND r.status = 'pending'
    LIMIT 1
  `
  return rows.length > 0 ? rows[0] : null
}

export async function countMonthlyConfirmedReferrals(databaseUrl: string, referrer: string): Promise<number> {
  const db = getDb(databaseUrl)
  const rows = await db`
    SELECT COUNT(*) as cnt FROM referrals
    WHERE referrer = ${referrer.toLowerCase()}
      AND status = 'confirmed'
      AND confirmed_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
  `
  return Number(rows[0].cnt)
}

export async function confirmReferral(databaseUrl: string, referralId: number, policyId: string, chainId: number) {
  const db = getDb(databaseUrl)
  await db`
    UPDATE referrals SET
      status = 'confirmed',
      points_awarded = true,
      policy_id = ${policyId},
      chain_id = ${chainId},
      confirmed_at = NOW()
    WHERE id = ${referralId}
  `
}

export async function hasMerchantPlan(databaseUrl: string, merchant: string): Promise<boolean> {
  const db = getDb(databaseUrl)
  const rows = await db`
    SELECT 1 FROM plan_metadata WHERE merchant_address = ${merchant.toLowerCase()} AND status = 'active' LIMIT 1
  `
  return rows.length > 0
}

// ── Leaderboard queries ──────────────────────────────────────

export async function getLeaderboard(
  databaseUrl: string,
  period: 'all' | 'monthly' | 'weekly',
  page: number,
  limit: number
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  const db = getDb(databaseUrl)
  const offset = (page - 1) * limit

  const entries = await db`
    SELECT wallet,
      CASE
        WHEN ${period} = 'monthly' AND month_key = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM') THEN monthly_points
        WHEN ${period} = 'weekly' AND week_key = to_char(NOW() AT TIME ZONE 'UTC', 'IYYY-"W"IW') THEN weekly_points
        ELSE total_points
      END as points,
      total_usdc_volume,
      tier,
      current_streak
    FROM points_balances
    WHERE leaderboard_eligible = true
    ORDER BY points DESC, wallet ASC
    LIMIT ${limit} OFFSET ${offset}
  `

  const countRows = await db`
    SELECT COUNT(*) as cnt FROM points_balances WHERE leaderboard_eligible = true
  `

  return {
    entries: entries.map((row: any, i: number) => ({
      wallet: row.wallet,
      points: Number(row.points),
      total_usdc_volume: Number(row.total_usdc_volume),
      tier: row.tier,
      current_streak: row.current_streak,
      rank: offset + i + 1,
    })),
    total: Number(countRows[0].cnt),
  }
}

export async function getPointsBalance(databaseUrl: string, wallet: string): Promise<PointsBalance | null> {
  const db = getDb(databaseUrl)
  const rows = await db`
    SELECT * FROM points_balances WHERE wallet = ${wallet.toLowerCase()}
  `
  if (rows.length === 0) return null
  const r = rows[0] as any
  return {
    wallet: r.wallet,
    total_points: Number(r.total_points),
    total_usdc_volume: Number(r.total_usdc_volume),
    monthly_points: r.month_key === new Date().toISOString().slice(0, 7) ? Number(r.monthly_points) : 0,
    weekly_points: Number(r.weekly_points),
    current_streak: r.current_streak,
    longest_streak: r.longest_streak,
    tier: r.tier,
    leaderboard_eligible: r.leaderboard_eligible,
    last_active_at: r.last_active_at,
  }
}

export async function getWalletRank(databaseUrl: string, wallet: string, period: 'all' | 'monthly' | 'weekly'): Promise<number> {
  const db = getDb(databaseUrl)
  const w = wallet.toLowerCase()

  const rows = await db`
    SELECT COUNT(*) + 1 as rank FROM points_balances
    WHERE leaderboard_eligible = true
      AND CASE
        WHEN ${period} = 'monthly' AND month_key = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM') THEN monthly_points
        WHEN ${period} = 'weekly' AND week_key = to_char(NOW() AT TIME ZONE 'UTC', 'IYYY-"W"IW') THEN weekly_points
        ELSE total_points
      END > COALESCE((
        SELECT CASE
          WHEN ${period} = 'monthly' AND month_key = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM') THEN monthly_points
          WHEN ${period} = 'weekly' AND week_key = to_char(NOW() AT TIME ZONE 'UTC', 'IYYY-"W"IW') THEN weekly_points
          ELSE total_points
        END FROM points_balances WHERE wallet = ${w}
      ), 0)
  `
  return Number(rows[0].rank)
}

export async function getPointsHistory(
  databaseUrl: string,
  wallet: string,
  page: number,
  limit: number
) {
  const db = getDb(databaseUrl)
  const offset = (page - 1) * limit
  const w = wallet.toLowerCase()

  const events = await db`
    SELECT pe.id, pe.action_id, pa.display_name, pe.points, pe.usdc_amount, pa.category,
           pe.source_type, pe.source_ref, pe.created_at
    FROM points_events pe
    JOIN points_actions pa ON pe.action_id = pa.action_id
    WHERE pe.wallet = ${w}
    ORDER BY pe.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  const countRows = await db`
    SELECT COUNT(*) as cnt FROM points_events WHERE wallet = ${w}
  `

  return {
    events: events.map((r: any) => ({
      id: Number(r.id),
      action_id: r.action_id,
      display_name: r.display_name,
      points: r.points,
      usdc_amount: r.usdc_amount ? Number(r.usdc_amount) : null,
      category: r.category,
      source_type: r.source_type,
      source_ref: r.source_ref,
      created_at: r.created_at,
    })),
    total: Number(countRows[0].cnt),
  }
}

export async function getPointsActions(databaseUrl: string) {
  const db = getDb(databaseUrl)
  return db`SELECT * FROM points_actions WHERE enabled = true ORDER BY category, action_id`
}

// ── Off-chain action tracking ────────────────────────────────

export async function hasPointsEvent(databaseUrl: string, wallet: string, actionId: string): Promise<boolean> {
  const db = getDb(databaseUrl)
  const rows = await db`
    SELECT 1 FROM points_events WHERE wallet = ${wallet.toLowerCase()} AND action_id = ${actionId} LIMIT 1
  `
  return rows.length > 0
}

export async function countTodayEvents(databaseUrl: string, wallet: string, actionId: string): Promise<number> {
  const db = getDb(databaseUrl)
  const rows = await db`
    SELECT COUNT(*) as cnt FROM points_events
    WHERE wallet = ${wallet.toLowerCase()} AND action_id = ${actionId}
      AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')
  `
  return Number(rows[0].cnt)
}

// ── Referral codes ───────────────────────────────────────────

export async function getOrCreateReferralCode(databaseUrl: string, wallet: string): Promise<string> {
  const db = getDb(databaseUrl)
  const w = wallet.toLowerCase()

  const existing = await db`SELECT code FROM referral_codes WHERE wallet = ${w}`
  if (existing.length > 0) return existing[0].code

  // Generate 8-char alphanumeric code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  await db`INSERT INTO referral_codes (wallet, code) VALUES (${w}, ${code}) ON CONFLICT (wallet) DO NOTHING`

  // Re-read in case of race
  const row = await db`SELECT code FROM referral_codes WHERE wallet = ${w}`
  return row[0].code
}

export async function getReferralByCode(databaseUrl: string, code: string) {
  const db = getDb(databaseUrl)
  const rows = await db`SELECT * FROM referral_codes WHERE code = ${code}`
  return rows.length > 0 ? rows[0] : null
}

export async function isAlreadyReferred(databaseUrl: string, wallet: string): Promise<boolean> {
  const db = getDb(databaseUrl)
  const rows = await db`SELECT 1 FROM referrals WHERE referred = ${wallet.toLowerCase()} LIMIT 1`
  return rows.length > 0
}

export async function createReferral(databaseUrl: string, referrer: string, referred: string, code: string) {
  const db = getDb(databaseUrl)
  await db`
    INSERT INTO referrals (referrer, referred, referral_code)
    VALUES (${referrer.toLowerCase()}, ${referred.toLowerCase()}, ${code})
  `
}

export async function getReferralStats(databaseUrl: string, wallet: string) {
  const db = getDb(databaseUrl)
  const w = wallet.toLowerCase()

  const stats = await db`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
      COUNT(*) FILTER (WHERE status = 'pending') as pending
    FROM referrals WHERE referrer = ${w}
  `

  const pointsRows = await db`
    SELECT COALESCE(SUM(points), 0) as pts FROM points_events
    WHERE wallet = ${w} AND action_id = 'referral_value'
  `

  const monthlyCount = await countMonthlyConfirmedReferrals(databaseUrl, w)

  return {
    total_referrals: Number(stats[0].total),
    confirmed_referrals: Number(stats[0].confirmed),
    pending_referrals: Number(stats[0].pending),
    points_earned_from_referrals: Number(pointsRows[0].pts),
    monthly_referral_count: monthlyCount,
    monthly_referral_cap: 50,
  }
}
