import { randomBytes } from 'crypto'
import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:payer-email-verifications')

/**
 * One-time magic-link tokens for verifying a payer's email address.
 *
 * Kept separate from the merchant `email_verification_codes` table because:
 *   • codes are short numeric OTPs, tokens here are 64-hex secrets
 *   • merchant codes verify a merchant's login email, these verify a
 *     payer's notification email — different subject, different lifetime,
 *     different consumer semantics
 */

const TOKEN_TTL_HOURS = 24 * 7

export interface EmailVerificationToken {
  token: string
  chainId: number
  payer: string
  email: string
  expiresAt: Date
  consumedAt: Date | null
  createdAt: Date
}

export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex')
}

export async function createVerificationToken(
  databaseUrl: string,
  chainId: number,
  payer: string,
  email: string
): Promise<{ token: string; expiresAt: Date }> {
  const db = getDb(databaseUrl)
  const token = generateVerificationToken()
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000)

  await db`
    INSERT INTO payer_email_verifications (
      token, chain_id, payer, email, expires_at
    ) VALUES (
      ${token}, ${chainId}, ${payer.toLowerCase()}, ${email.trim().toLowerCase()}, ${expiresAt}
    )
  `

  logger.debug({ chainId, payer: payer.toLowerCase(), expiresAt }, 'Issued verification token')
  return { token, expiresAt }
}

/**
 * Atomically consume a verification token. Returns the associated
 * (chain_id, payer, email) if the token existed, hadn't expired, and
 * hadn't already been consumed. Returns null otherwise.
 *
 * Uses `UPDATE ... WHERE consumed_at IS NULL AND expires_at > NOW()
 * RETURNING ...` — a single statement, no TOCTOU window.
 */
export async function consumeVerificationToken(
  databaseUrl: string,
  token: string
): Promise<{ chainId: number; payer: string; email: string } | null> {
  const db = getDb(databaseUrl)

  const rows = await db<Array<{ chain_id: number; payer: string; email: string }>>`
    UPDATE payer_email_verifications
    SET consumed_at = NOW()
    WHERE token = ${token}
      AND consumed_at IS NULL
      AND expires_at > NOW()
    RETURNING chain_id, payer, email
  `

  const row = rows[0]
  if (!row) return null
  return { chainId: row.chain_id, payer: row.payer, email: row.email }
}

/**
 * Look up a token without consuming it — for diagnostics and to distinguish
 * "expired" from "unknown" for the verify endpoint's error page.
 */
export async function peekVerificationToken(
  databaseUrl: string,
  token: string
): Promise<EmailVerificationToken | null> {
  const db = getDb(databaseUrl)
  const rows = await db<Array<{
    token: string; chain_id: number; payer: string; email: string
    expires_at: Date; consumed_at: Date | null; created_at: Date
  }>>`
    SELECT token, chain_id, payer, email, expires_at, consumed_at, created_at
    FROM payer_email_verifications WHERE token = ${token}
  `
  const row = rows[0]
  if (!row) return null
  return {
    token: row.token,
    chainId: row.chain_id,
    payer: row.payer,
    email: row.email,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
  }
}
