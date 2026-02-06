import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:metadata')

export interface PlanMetadata {
  version: string
  plan: {
    name: string
    description: string
    tier?: string
    features?: string[]
  }
  merchant: {
    name: string
    logo?: string
    website?: string
    supportEmail?: string
    termsUrl?: string
    privacyUrl?: string
  }
  display?: {
    color?: string
    badge?: string
    icon?: string
  }
}

export interface PlanMetadataRow {
  id: string
  merchant_address: string
  metadata: PlanMetadata
  created_at: Date
  updated_at: Date
}

export async function upsertPlanMetadata(
  databaseUrl: string,
  id: string,
  merchantAddress: string,
  metadata: PlanMetadata
): Promise<void> {
  const db = getDb(databaseUrl)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonValue = metadata as any
  await db`
    INSERT INTO plan_metadata (id, merchant_address, metadata, updated_at)
    VALUES (${id}, ${merchantAddress.toLowerCase()}, ${db.json(jsonValue)}, NOW())
    ON CONFLICT (id) DO UPDATE
    SET
      merchant_address = ${merchantAddress.toLowerCase()},
      metadata = ${db.json(jsonValue)},
      updated_at = NOW()
  `

  logger.info({ id, merchantAddress }, 'Upserted plan metadata')
}

export async function getPlanMetadata(
  databaseUrl: string,
  id: string
): Promise<PlanMetadataRow | null> {
  const db = getDb(databaseUrl)

  const rows = await db<PlanMetadataRow[]>`
    SELECT * FROM plan_metadata WHERE id = ${id}
  `

  return rows[0] ?? null
}

export async function getPlanMetadataByMerchant(
  databaseUrl: string,
  merchantAddress: string
): Promise<PlanMetadataRow[]> {
  const db = getDb(databaseUrl)

  const rows = await db<PlanMetadataRow[]>`
    SELECT * FROM plan_metadata
    WHERE merchant_address = ${merchantAddress.toLowerCase()}
    ORDER BY created_at DESC
  `

  return rows
}

export async function deletePlanMetadata(
  databaseUrl: string,
  id: string
): Promise<boolean> {
  const db = getDb(databaseUrl)

  const result = await db`
    DELETE FROM plan_metadata WHERE id = ${id}
    RETURNING id
  `

  if (result.length > 0) {
    logger.info({ id }, 'Deleted plan metadata')
    return true
  }

  return false
}

export async function listAllPlanMetadata(
  databaseUrl: string
): Promise<PlanMetadataRow[]> {
  const db = getDb(databaseUrl)

  const rows = await db<PlanMetadataRow[]>`
    SELECT * FROM plan_metadata
    ORDER BY created_at DESC
  `

  return rows
}
