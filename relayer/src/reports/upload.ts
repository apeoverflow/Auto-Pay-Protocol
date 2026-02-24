import { generateMonthlyReport, type MonthlyReport } from './generate.js'
import { uploadJSON } from '../lib/storacha.js'
import { saveReport } from '../db/reports.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('reports:upload')

/**
 * Generate a monthly report and save it to the DB only (no IPFS upload).
 * Use this when Storacha is not configured.
 */
export async function generateAndSaveReport(
  databaseUrl: string,
  chainId: number,
  merchantAddress: string,
  period: string
): Promise<{ report: MonthlyReport; cid: null }> {
  const addr = merchantAddress.toLowerCase()

  const report = await generateMonthlyReport(databaseUrl, chainId, addr, period)

  await saveReport(databaseUrl, addr, chainId, period, null, report)

  logger.info({ merchant: addr, chainId, period }, 'Report generated and saved locally')

  return { report, cid: null }
}

/**
 * Generate and upload a monthly report for a merchant as plain JSON.
 * Returns the IPFS CID of the uploaded report. Also caches JSON in DB.
 */
export async function generateAndUploadReport(
  databaseUrl: string,
  chainId: number,
  merchantAddress: string,
  period: string
): Promise<{ report: MonthlyReport; cid: string }> {
  const addr = merchantAddress.toLowerCase()

  const report = await generateMonthlyReport(databaseUrl, chainId, addr, period)

  const cidStr = await uploadJSON(report)

  await saveReport(databaseUrl, addr, chainId, period, cidStr, report)

  logger.info({ merchant: addr, chainId, period, cid: cidStr }, 'Report generated and uploaded')

  return { report, cid: cidStr }
}
