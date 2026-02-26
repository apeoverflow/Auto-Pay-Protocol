import { randomBytes } from 'crypto'
import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:checkout-links')

// URL-safe alphabet (64 chars — no modulo bias since 256 % 64 === 0)
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export function generateShortId(length = 8): string {
  const bytes = randomBytes(length)
  let id = ''
  for (let i = 0; i < length; i++) {
    id += ALPHABET[bytes[i] & 63] // & 63 === % 64, no bias
  }
  return id
}

export interface CheckoutLinkRow {
  short_id: string
  plan_id: string
  merchant_address: string
  success_url: string | null
  cancel_url: string | null
  fields: string | null
  created_at: Date
}

export async function createCheckoutLink(
  databaseUrl: string,
  shortId: string,
  planId: string,
  merchantAddress: string,
  overrides: { successUrl?: string; cancelUrl?: string; fields?: string }
): Promise<void> {
  const db = getDb(databaseUrl)

  await db`
    INSERT INTO checkout_links (short_id, plan_id, merchant_address, success_url, cancel_url, fields)
    VALUES (
      ${shortId},
      ${planId},
      ${merchantAddress.toLowerCase()},
      ${overrides.successUrl ?? null},
      ${overrides.cancelUrl ?? null},
      ${overrides.fields ?? null}
    )
  `

  logger.info({ shortId, planId, merchantAddress }, 'Created checkout link')
}

export async function getCheckoutLink(
  databaseUrl: string,
  shortId: string
): Promise<CheckoutLinkRow | null> {
  const db = getDb(databaseUrl)

  const rows = await db<CheckoutLinkRow[]>`
    SELECT * FROM checkout_links WHERE short_id = ${shortId}
  `
  return rows[0] ?? null
}

export async function getCheckoutLinksByPlan(
  databaseUrl: string,
  planId: string,
  merchantAddress: string
): Promise<CheckoutLinkRow[]> {
  const db = getDb(databaseUrl)

  return db<CheckoutLinkRow[]>`
    SELECT * FROM checkout_links
    WHERE plan_id = ${planId} AND merchant_address = ${merchantAddress.toLowerCase()}
    ORDER BY created_at DESC
  `
}

export async function deleteCheckoutLink(
  databaseUrl: string,
  shortId: string,
  merchantAddress: string
): Promise<boolean> {
  const db = getDb(databaseUrl)

  const result = await db`
    DELETE FROM checkout_links
    WHERE short_id = ${shortId} AND merchant_address = ${merchantAddress.toLowerCase()}
    RETURNING short_id
  `

  if (result.length > 0) {
    logger.info({ shortId, merchantAddress }, 'Deleted checkout link')
    return true
  }

  return false
}
