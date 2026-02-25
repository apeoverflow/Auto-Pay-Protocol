import type { MerchantRow } from '../types.js'
import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:merchants')

export async function getMerchant(
  databaseUrl: string,
  address: string
): Promise<MerchantRow | null> {
  const db = getDb(databaseUrl)

  const rows = await db<MerchantRow[]>`
    SELECT * FROM merchants
    WHERE address = ${address.toLowerCase()}
  `

  return rows[0] ?? null
}

export async function upsertMerchant(
  databaseUrl: string,
  address: string,
  webhookUrl?: string,
  webhookSecret?: string
) {
  const db = getDb(databaseUrl)

  await db`
    INSERT INTO merchants (address, webhook_url, webhook_secret)
    VALUES (${address.toLowerCase()}, ${webhookUrl ?? null}, ${webhookSecret ?? null})
    ON CONFLICT (address) DO UPDATE
    SET
      webhook_url = COALESCE(${webhookUrl ?? null}, merchants.webhook_url),
      webhook_secret = COALESCE(${webhookSecret ?? null}, merchants.webhook_secret)
  `

  logger.debug({ address }, 'Upserted merchant')
}

export async function getMerchantWebhookConfig(
  databaseUrl: string,
  address: string
): Promise<{ webhookUrl: string; webhookSecret: string } | null> {
  const db = getDb(databaseUrl)

  const rows = await db`
    SELECT webhook_url, webhook_secret
    FROM merchants
    WHERE address = ${address.toLowerCase()}
      AND webhook_url IS NOT NULL
      AND webhook_secret IS NOT NULL
  `

  if (rows.length === 0 || !rows[0].webhook_url || !rows[0].webhook_secret) {
    return null
  }

  return {
    webhookUrl: rows[0].webhook_url,
    webhookSecret: rows[0].webhook_secret,
  }
}

export async function clearMerchantWebhook(
  databaseUrl: string,
  address: string
): Promise<void> {
  const db = getDb(databaseUrl)

  await db`
    UPDATE merchants
    SET webhook_url = NULL, webhook_secret = NULL
    WHERE address = ${address.toLowerCase()}
  `

  logger.debug({ address }, 'Cleared merchant webhook')
}

export async function updateMerchantWebhook(
  databaseUrl: string,
  address: string,
  webhookUrl: string,
  webhookSecret: string
): Promise<void> {
  const db = getDb(databaseUrl)

  await db`
    INSERT INTO merchants (address, webhook_url, webhook_secret)
    VALUES (${address.toLowerCase()}, ${webhookUrl}, ${webhookSecret})
    ON CONFLICT (address) DO UPDATE
    SET webhook_url = ${webhookUrl}, webhook_secret = ${webhookSecret}
  `

  logger.debug({ address }, 'Updated merchant webhook')
}

export async function listMerchants(
  databaseUrl: string
): Promise<MerchantRow[]> {
  const db = getDb(databaseUrl)

  const rows = await db<MerchantRow[]>`
    SELECT * FROM merchants
    ORDER BY created_at DESC
  `

  return rows
}
