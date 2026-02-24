import { getDb } from '../db/index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('reports:generate')

export interface MonthlyReport {
  version: '1.0'
  type: 'monthly-report'
  merchant: string
  chainId: number
  period: string // YYYY-MM
  generatedAt: string
  revenue: {
    totalRevenue: string
    protocolFees: string
    netRevenue: string
  }
  charges: {
    total: number
    successful: number
    failed: number
    failureRate: number
  }
  subscribers: {
    active: number
    new: number
    cancelled: number
    cancelledByFailure: number
    churnRate: number
  }
  topPlans: Array<{
    planId: string | null
    planMerchant: string | null
    subscribers: number
    revenue: string
  }>
  chargeReceipts: string[] // CIDs of individual charge receipts
}

/**
 * Generate a monthly report for a merchant on a specific chain.
 * @param period - YYYY-MM format (e.g. "2026-02")
 */
export async function generateMonthlyReport(
  databaseUrl: string,
  chainId: number,
  merchantAddress: string,
  period: string
): Promise<MonthlyReport> {
  const db = getDb(databaseUrl)
  const addr = merchantAddress.toLowerCase()

  // Parse period boundaries
  const [year, month] = period.split('-').map(Number)
  const periodStart = new Date(Date.UTC(year, month - 1, 1))
  const periodEnd = new Date(Date.UTC(year, month, 1)) // first day of next month

  logger.info({ chainId, merchant: addr, period }, 'Generating monthly report')

  const startIso = periodStart.toISOString()
  const endIso = periodEnd.toISOString()

  // Run all independent queries in parallel
  const [
    revenueRows,
    failedRows,
    activeRows,
    newRows,
    cancelledRows,
    cancelledByFailureRows,
    topPlanRows,
    receiptRows,
  ] = await Promise.all([
    // Revenue aggregation from successful charges in the period
    db`
      SELECT
        COALESCE(SUM(c.amount::numeric), 0)::text AS total_revenue,
        COALESCE(SUM(c.protocol_fee::numeric), 0)::text AS protocol_fees,
        COUNT(*)::int AS successful_count
      FROM charges c
      JOIN policies p ON c.policy_id = p.id AND c.chain_id = p.chain_id
      WHERE p.merchant = ${addr}
        AND c.chain_id = ${chainId}
        AND c.status = 'success'
        AND c.completed_at >= ${startIso}
        AND c.completed_at < ${endIso}
    `,
    // Failed charges in the period
    db`
      SELECT COUNT(*)::int AS failed_count
      FROM charges c
      JOIN policies p ON c.policy_id = p.id AND c.chain_id = p.chain_id
      WHERE p.merchant = ${addr}
        AND c.chain_id = ${chainId}
        AND c.status = 'failed'
        AND c.completed_at >= ${startIso}
        AND c.completed_at < ${endIso}
    `,
    // Active subscribers at end of period
    db`
      SELECT COUNT(*)::int AS active_count
      FROM policies
      WHERE merchant = ${addr}
        AND chain_id = ${chainId}
        AND active = true
        AND created_at < ${endIso}
    `,
    // New subscribers in the period
    db`
      SELECT COUNT(*)::int AS new_count
      FROM policies
      WHERE merchant = ${addr}
        AND chain_id = ${chainId}
        AND created_at >= ${startIso}
        AND created_at < ${endIso}
    `,
    // Cancelled (revoked) in the period
    db`
      SELECT COUNT(*)::int AS cancelled_count
      FROM policies
      WHERE merchant = ${addr}
        AND chain_id = ${chainId}
        AND active = false
        AND cancelled_by_failure = false
        AND ended_at >= ${startIso}
        AND ended_at < ${endIso}
    `,
    // Cancelled by failure in the period
    db`
      SELECT COUNT(*)::int AS cancelled_by_failure_count
      FROM policies
      WHERE merchant = ${addr}
        AND chain_id = ${chainId}
        AND cancelled_by_failure = true
        AND cancelled_at >= ${startIso}
        AND cancelled_at < ${endIso}
    `,
    // Top plans by subscriber count
    db`
      SELECT
        p.plan_id,
        p.plan_merchant,
        COUNT(*)::int AS subscribers,
        COALESCE(SUM(c.amount::numeric), 0)::text AS revenue
      FROM policies p
      LEFT JOIN charges c ON c.policy_id = p.id AND c.chain_id = p.chain_id
        AND c.status = 'success'
        AND c.completed_at >= ${startIso}
        AND c.completed_at < ${endIso}
      WHERE p.merchant = ${addr}
        AND p.chain_id = ${chainId}
        AND p.created_at < ${endIso}
      GROUP BY p.plan_id, p.plan_merchant
      ORDER BY subscribers DESC
      LIMIT 10
    `,
    // Charge receipt CIDs
    db`
      SELECT c.receipt_cid
      FROM charges c
      JOIN policies p ON c.policy_id = p.id AND c.chain_id = p.chain_id
      WHERE p.merchant = ${addr}
        AND c.chain_id = ${chainId}
        AND c.status = 'success'
        AND c.receipt_cid IS NOT NULL
        AND c.completed_at >= ${startIso}
        AND c.completed_at < ${endIso}
      ORDER BY c.completed_at
    `,
  ])

  const totalRevenue = revenueRows[0]?.total_revenue ?? '0'
  const protocolFees = revenueRows[0]?.protocol_fees ?? '0'
  const netRevenue = String(Number(totalRevenue) - Number(protocolFees))
  const successfulCharges = revenueRows[0]?.successful_count ?? 0
  const failedCharges = failedRows[0]?.failed_count ?? 0
  const totalCharges = successfulCharges + failedCharges
  const failureRate = totalCharges > 0 ? failedCharges / totalCharges : 0

  const activeSubscribers = activeRows[0]?.active_count ?? 0
  const newSubscribers = newRows[0]?.new_count ?? 0
  const cancelledSubscribers = cancelledRows[0]?.cancelled_count ?? 0
  const cancelledByFailure = cancelledByFailureRows[0]?.cancelled_by_failure_count ?? 0
  const totalCancelled = cancelledSubscribers + cancelledByFailure
  // Churn = cancelled / (active at start of period) where start = active_now - new + cancelled
  const startOfPeriodActive = activeSubscribers - newSubscribers + totalCancelled
  const churnRate = startOfPeriodActive > 0 ? totalCancelled / startOfPeriodActive : 0

  const report: MonthlyReport = {
    version: '1.0',
    type: 'monthly-report',
    merchant: addr,
    chainId,
    period,
    generatedAt: new Date().toISOString(),
    revenue: {
      totalRevenue,
      protocolFees,
      netRevenue,
    },
    charges: {
      total: totalCharges,
      successful: successfulCharges,
      failed: failedCharges,
      failureRate: Math.round(failureRate * 10000) / 10000, // 4 decimal precision
    },
    subscribers: {
      active: activeSubscribers,
      new: newSubscribers,
      cancelled: cancelledSubscribers,
      cancelledByFailure,
      churnRate: Math.round(churnRate * 10000) / 10000,
    },
    topPlans: topPlanRows.map((r) => ({
      planId: r.plan_id,
      planMerchant: r.plan_merchant,
      subscribers: r.subscribers,
      revenue: r.revenue,
    })),
    chargeReceipts: receiptRows.map((r) => r.receipt_cid),
  }

  logger.info(
    { chainId, merchant: addr, period, charges: totalCharges, revenue: totalRevenue },
    'Monthly report generated'
  )

  return report
}
