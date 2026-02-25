import { randomBytes, createHash } from 'crypto'
import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:api-keys')

const KEY_PREFIX = 'sk_live_'

export interface ApiKeyRow {
  id: number
  merchant: string
  key_prefix: string
  label: string
  created_at: Date
  last_used_at: Date | null
  revoked_at: Date | null
}

export interface ApiKeyPublic {
  id: number
  keyPrefix: string
  label: string
  createdAt: Date
  lastUsedAt: Date | null
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Create a new API key for a merchant.
 * Returns the plaintext key — this is the only time it's available.
 */
export async function createApiKey(
  databaseUrl: string,
  merchant: string,
  label: string
): Promise<{ key: string; id: number; keyPrefix: string; label: string; createdAt: Date }> {
  const db = getDb(databaseUrl)
  const addr = merchant.toLowerCase()

  const secret = randomBytes(32).toString('hex')
  const key = `${KEY_PREFIX}${secret}`
  const keyHash = hashKey(key)
  const keyPrefix = `${KEY_PREFIX}${secret.slice(0, 8)}...`

  const rows = await db<{ id: number; created_at: Date }[]>`
    INSERT INTO merchant_api_keys (merchant, key_hash, key_prefix, label)
    VALUES (${addr}, ${keyHash}, ${keyPrefix}, ${label})
    RETURNING id, created_at
  `

  logger.info({ merchant: addr, keyPrefix }, 'Created API key')

  return {
    key,
    id: rows[0].id,
    keyPrefix,
    label,
    createdAt: rows[0].created_at,
  }
}

/**
 * Validate an API key. Returns the merchant address if valid, null otherwise.
 * Updates last_used_at on successful validation.
 */
export async function validateApiKey(
  databaseUrl: string,
  key: string
): Promise<{ merchant: string; label: string } | null> {
  if (!key.startsWith(KEY_PREFIX)) return null

  const db = getDb(databaseUrl)
  const keyHash = hashKey(key)

  const rows = await db<{ id: number; merchant: string; label: string }[]>`
    SELECT id, merchant, label FROM merchant_api_keys
    WHERE key_hash = ${keyHash} AND revoked_at IS NULL
  `

  if (rows.length === 0) return null

  // Update last_used_at (fire-and-forget)
  db`UPDATE merchant_api_keys SET last_used_at = NOW() WHERE id = ${rows[0].id}`.catch(() => {})

  return { merchant: rows[0].merchant, label: rows[0].label }
}

/**
 * List all API keys for a merchant (no secrets returned).
 */
export async function listApiKeys(
  databaseUrl: string,
  merchant: string
): Promise<ApiKeyPublic[]> {
  const db = getDb(databaseUrl)
  const addr = merchant.toLowerCase()

  const rows = await db<ApiKeyRow[]>`
    SELECT id, key_prefix, label, created_at, last_used_at
    FROM merchant_api_keys
    WHERE merchant = ${addr} AND revoked_at IS NULL
    ORDER BY created_at DESC
  `

  return rows.map((r) => ({
    id: r.id,
    keyPrefix: r.key_prefix,
    label: r.label,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
  }))
}

/**
 * Revoke an API key. Scoped to the merchant for safety.
 */
export async function revokeApiKey(
  databaseUrl: string,
  merchant: string,
  keyId: number
): Promise<boolean> {
  const db = getDb(databaseUrl)
  const addr = merchant.toLowerCase()

  const result = await db`
    UPDATE merchant_api_keys
    SET revoked_at = NOW()
    WHERE id = ${keyId} AND merchant = ${addr} AND revoked_at IS NULL
  `

  const revoked = result.count > 0
  if (revoked) {
    logger.info({ merchant: addr, keyId }, 'Revoked API key')
  }
  return revoked
}
