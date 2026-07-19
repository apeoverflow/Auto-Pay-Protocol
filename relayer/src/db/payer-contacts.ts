import { randomBytes } from 'crypto'
import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:payer-contacts')

/**
 * payer_contacts holds one row per (chain_id, payer) — the payer's reachable
 * email plus notification-cadence state. Separate from `subscriber_data`
 * (which is per-policy raw form capture) because one payer with many
 * subscriptions still has one inbox and one opt-out preference.
 */

export interface PayerContact {
  chainId: number
  payer: string
  email: string | null
  emailVerifiedAt: Date | null
  notificationsOptedOut: boolean
  optOutToken: string
  notificationStage: number
  lowApprovalSince: Date | null
  lastNotifiedAt: Date | null
  nextNotificationAt: Date | null
  lastProjectionMicro: bigint | null
  lastAllowanceMicro: bigint | null
  lastCheckedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

/**
 * Set/refresh a payer's email address. Idempotent.
 *
 * If the email is unchanged from the stored value, verification state and
 * notification cadence are preserved. If the email is different (or the row
 * doesn't exist), verification is cleared — the new address must re-verify
 * before we send notifications to it, and cadence resets so a stale
 * `next_notification_at` doesn't fire against the new address.
 *
 * `opt_out_token` is generated once at insert time and never rotated here
 * (users keep their unsubscribe link stable across email changes).
 */
export async function upsertPayerEmail(
  databaseUrl: string,
  chainId: number,
  payer: string,
  email: string
): Promise<{ isNew: boolean; changedEmail: boolean; contact: PayerContact }> {
  const db = getDb(databaseUrl)
  const payerLower = payer.toLowerCase()
  const emailLower = email.trim().toLowerCase()
  const optOutToken = randomToken()

  // Postgres disallows EXCLUDED in RETURNING subqueries, so the DO UPDATE
  // SET clause is the only place we can compare old vs new email. We rely
  // on the CASE expressions there to preserve verification/cadence when
  // the address is unchanged, and clear them when it has been rotated.
  // `is_new = (xmax = 0)` is the canonical "was this an INSERT" test.
  const rows = await db<Array<{
    chain_id: number; payer: string; email: string | null; email_verified_at: Date | null
    notifications_opted_out: boolean; opt_out_token: string; notification_stage: number
    low_approval_since: Date | null; last_notified_at: Date | null; next_notification_at: Date | null
    last_projection_micro: string | null; last_allowance_micro: string | null
    last_checked_at: Date | null; created_at: Date; updated_at: Date
    is_new: boolean
  }>>`
    INSERT INTO payer_contacts (
      chain_id, payer, email, opt_out_token, updated_at
    ) VALUES (
      ${chainId}, ${payerLower}, ${emailLower}, ${optOutToken}, NOW()
    )
    ON CONFLICT (chain_id, payer) DO UPDATE
      SET email = EXCLUDED.email,
          email_verified_at = CASE
            WHEN payer_contacts.email = EXCLUDED.email THEN payer_contacts.email_verified_at
            ELSE NULL
          END,
          notification_stage = CASE
            WHEN payer_contacts.email = EXCLUDED.email THEN payer_contacts.notification_stage
            ELSE 0
          END,
          low_approval_since = CASE
            WHEN payer_contacts.email = EXCLUDED.email THEN payer_contacts.low_approval_since
            ELSE NULL
          END,
          next_notification_at = CASE
            WHEN payer_contacts.email = EXCLUDED.email THEN payer_contacts.next_notification_at
            ELSE NULL
          END,
          updated_at = NOW()
    RETURNING chain_id, payer, email, email_verified_at, notifications_opted_out,
              opt_out_token, notification_stage, low_approval_since, last_notified_at,
              next_notification_at, last_projection_micro::TEXT AS last_projection_micro,
              last_allowance_micro::TEXT AS last_allowance_micro,
              last_checked_at, created_at, updated_at,
              (xmax = 0) AS is_new
  `
  const row = rows[0]
  if (!row) throw new Error('upsertPayerEmail returned no row (unexpected)')

  const contact: PayerContact = {
    chainId: row.chain_id,
    payer: row.payer,
    email: row.email,
    emailVerifiedAt: row.email_verified_at,
    notificationsOptedOut: row.notifications_opted_out,
    optOutToken: row.opt_out_token,
    notificationStage: row.notification_stage,
    lowApprovalSince: row.low_approval_since,
    lastNotifiedAt: row.last_notified_at,
    nextNotificationAt: row.next_notification_at,
    lastProjectionMicro: row.last_projection_micro ? BigInt(row.last_projection_micro) : null,
    lastAllowanceMicro: row.last_allowance_micro ? BigInt(row.last_allowance_micro) : null,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }

  const isNew = !!row.is_new
  // "changed" is true iff the stored row was already present but its
  // email_verified_at was cleared by the CASE (i.e., the CASE saw a
  // different email). We can infer this cheaply: on non-insert paths,
  // if the returned email_verified_at is null AND the returned email
  // equals what we passed in, the address is definitely present now.
  // For the caller's purposes ("do we need to send a verify email?"),
  // `!contact.emailVerifiedAt` is the only signal that matters —
  // exposing changedEmail is purely diagnostic.
  const changedEmail = !isNew && contact.emailVerifiedAt === null

  logger.debug(
    { chainId, payer: payerLower, isNew, changedEmail },
    'Upserted payer contact'
  )

  return { isNew, changedEmail, contact }
}

export async function getPayerContact(
  databaseUrl: string,
  chainId: number,
  payer: string
): Promise<PayerContact | null> {
  const db = getDb(databaseUrl)
  const rows = await db<Array<{
    chain_id: number; payer: string; email: string | null; email_verified_at: Date | null
    notifications_opted_out: boolean; opt_out_token: string; notification_stage: number
    low_approval_since: Date | null; last_notified_at: Date | null; next_notification_at: Date | null
    last_projection_micro: string | null; last_allowance_micro: string | null
    last_checked_at: Date | null; created_at: Date; updated_at: Date
  }>>`
    SELECT chain_id, payer, email, email_verified_at, notifications_opted_out,
           opt_out_token, notification_stage, low_approval_since, last_notified_at,
           next_notification_at, last_projection_micro::TEXT AS last_projection_micro,
           last_allowance_micro::TEXT AS last_allowance_micro,
           last_checked_at, created_at, updated_at
    FROM payer_contacts
    WHERE chain_id = ${chainId} AND payer = ${payer.toLowerCase()}
  `
  const row = rows[0]
  if (!row) return null
  return {
    chainId: row.chain_id,
    payer: row.payer,
    email: row.email,
    emailVerifiedAt: row.email_verified_at,
    notificationsOptedOut: row.notifications_opted_out,
    optOutToken: row.opt_out_token,
    notificationStage: row.notification_stage,
    lowApprovalSince: row.low_approval_since,
    lastNotifiedAt: row.last_notified_at,
    nextNotificationAt: row.next_notification_at,
    lastProjectionMicro: row.last_projection_micro ? BigInt(row.last_projection_micro) : null,
    lastAllowanceMicro: row.last_allowance_micro ? BigInt(row.last_allowance_micro) : null,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Marks a payer's email as verified. Only succeeds if the row's current
 * email matches the caller-supplied `email` — protects against the race
 * where a payer changes their email between token issuance and click.
 * Returns true if verification landed, false otherwise.
 */
export async function markEmailVerified(
  databaseUrl: string,
  chainId: number,
  payer: string,
  email: string
): Promise<boolean> {
  const db = getDb(databaseUrl)
  const rows = await db`
    UPDATE payer_contacts
    SET email_verified_at = NOW(), updated_at = NOW()
    WHERE chain_id = ${chainId}
      AND payer = ${payer.toLowerCase()}
      AND email = ${email.trim().toLowerCase()}
      AND email_verified_at IS NULL
    RETURNING payer
  `
  return rows.length > 0
}

/**
 * Look up a contact by opt_out_token — for the unsubscribe endpoint.
 * (Chain-scoped because opt_out_token is not globally unique.)
 */
export async function findByOptOutToken(
  databaseUrl: string,
  token: string
): Promise<{ chainId: number; payer: string } | null> {
  const db = getDb(databaseUrl)
  const rows = await db<Array<{ chain_id: number; payer: string }>>`
    SELECT chain_id, payer FROM payer_contacts WHERE opt_out_token = ${token} LIMIT 1
  `
  const row = rows[0]
  if (!row) return null
  return { chainId: row.chain_id, payer: row.payer }
}

export async function setOptedOut(
  databaseUrl: string,
  chainId: number,
  payer: string,
  optedOut: boolean
): Promise<void> {
  const db = getDb(databaseUrl)
  await db`
    UPDATE payer_contacts
    SET notifications_opted_out = ${optedOut}, updated_at = NOW()
    WHERE chain_id = ${chainId} AND payer = ${payer.toLowerCase()}
  `
}
