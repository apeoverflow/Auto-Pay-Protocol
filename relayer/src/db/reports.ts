import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:reports')

export interface ReportRow {
  merchant_address: string
  chain_id: number
  period: string
  cid: string | null
  report_json: unknown | null
  created_at: Date
}

export async function saveReport(
  databaseUrl: string,
  merchantAddress: string,
  chainId: number,
  period: string,
  cid: string | null,
  reportJson?: unknown
): Promise<void> {
  const db = getDb(databaseUrl)
  const addr = merchantAddress.toLowerCase()

  if (reportJson !== undefined) {
    const jsonVal = reportJson as any
    await db`
      INSERT INTO merchant_reports (merchant_address, chain_id, period, cid, report_json)
      VALUES (${addr}, ${chainId}, ${period}, ${cid}, ${db.json(jsonVal)})
      ON CONFLICT (merchant_address, chain_id, period) DO UPDATE
      SET cid = COALESCE(${cid}, merchant_reports.cid),
          report_json = COALESCE(${db.json(jsonVal)}, merchant_reports.report_json),
          created_at = NOW()
    `
  } else {
    await db`
      INSERT INTO merchant_reports (merchant_address, chain_id, period, cid)
      VALUES (${addr}, ${chainId}, ${period}, ${cid})
      ON CONFLICT (merchant_address, chain_id, period) DO UPDATE
      SET cid = COALESCE(${cid}, merchant_reports.cid),
          created_at = NOW()
    `
  }

  logger.debug({ merchant: addr, chainId, period, cid }, 'Saved report')
}

export async function getReportsByMerchant(
  databaseUrl: string,
  merchantAddress: string,
  chainId?: number
): Promise<ReportRow[]> {
  const db = getDb(databaseUrl)
  const addr = merchantAddress.toLowerCase()
  const chainFilter = chainId != null ? db`AND chain_id = ${chainId}` : db``

  const rows = await db<ReportRow[]>`
    SELECT merchant_address, chain_id, period, cid, created_at
    FROM merchant_reports
    WHERE merchant_address = ${addr}
      ${chainFilter}
    ORDER BY period DESC
  `

  return rows
}

export async function getReport(
  databaseUrl: string,
  merchantAddress: string,
  chainId: number,
  period: string
): Promise<ReportRow | null> {
  const db = getDb(databaseUrl)
  const addr = merchantAddress.toLowerCase()

  const rows = await db<ReportRow[]>`
    SELECT merchant_address, chain_id, period, cid, report_json, created_at
    FROM merchant_reports
    WHERE merchant_address = ${addr}
      AND chain_id = ${chainId}
      AND period = ${period}
  `

  return rows[0] ?? null
}
