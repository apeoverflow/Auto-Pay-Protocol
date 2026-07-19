import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:email-outbox')

/**
 * email_outbox is a retryable transactional-email queue with two failover-
 * safety properties:
 *
 *   1. Idempotent enqueue: every row has a `dedupe_key` UNIQUE column. Callers
 *      insert with `ON CONFLICT (dedupe_key) DO NOTHING`, so a monitor tick
 *      that crashes mid-flight can be safely re-run — no double-enqueue.
 *
 *   2. Crash-safe claim: the sender claims rows via `UPDATE ... WHERE id IN
 *      (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING ...`, setting a short
 *      `leased_until` timestamp. A peer sender running concurrently sees a
 *      disjoint set of rows; a sender that dies mid-send releases its lease
 *      automatically once the timestamp passes.
 *
 * We deliberately do NOT increment `attempts` on claim. If we crashed after
 * calling Resend but before writing back, incrementing on claim would burn
 * attempts on crashes that never touched the provider. Instead, `attempts`
 * is bumped inside `markSent` / `markFailed`, and Resend's own idempotency
 * key (derived from `dedupe_key`) protects against a duplicate send if the
 * lease expires and a peer re-sends the same payload.
 */

export type OutboxTemplate = 'email_verify' | 'low_approval' | 'approval_recovered'

export interface OutboxRow {
  id: number
  dedupeKey: string
  toAddress: string
  template: OutboxTemplate
  payload: Record<string, unknown>
  attempts: number
  createdAt: Date
}

/**
 * Enqueue an email. Returns true if a new row was inserted, false if an
 * existing row with the same dedupe_key was already present (which is the
 * intended, non-error outcome for retries).
 */
export async function enqueueEmail(
  databaseUrl: string,
  params: {
    dedupeKey: string
    toAddress: string
    template: OutboxTemplate
    payload: Record<string, unknown>
    nextAttemptAt?: Date
  }
): Promise<boolean> {
  const db = getDb(databaseUrl)

  const rows = await db<Array<{ id: number }>>`
    INSERT INTO email_outbox (
      dedupe_key, to_address, template, payload, next_attempt_at
    ) VALUES (
      ${params.dedupeKey},
      ${params.toAddress},
      ${params.template},
      ${db.json(params.payload as unknown as Parameters<typeof db.json>[0])},
      ${params.nextAttemptAt ?? new Date()}
    )
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING id
  `

  const inserted = rows.length > 0
  logger.debug(
    { dedupeKey: params.dedupeKey, template: params.template, inserted },
    inserted ? 'Enqueued email' : 'Email already in outbox (dedupe hit)'
  )
  return inserted
}

/**
 * Atomically claim up to `limit` pending rows whose next_attempt_at has
 * passed and whose lease (if any) has expired. Extends the lease so peer
 * senders skip these rows. Returns the claimed row payloads.
 *
 * FOR UPDATE SKIP LOCKED prevents concurrent senders from serialising
 * against the same rows; the CTE approach keeps the whole claim atomic.
 */
export async function claimPendingEmails(
  databaseUrl: string,
  limit: number,
  leaseSeconds: number
): Promise<OutboxRow[]> {
  const db = getDb(databaseUrl)

  const rows = await db<Array<{
    id: number
    dedupe_key: string
    to_address: string
    template: OutboxTemplate
    payload: Record<string, unknown>
    attempts: number
    created_at: Date
  }>>`
    WITH claimable AS (
      SELECT id FROM email_outbox
      WHERE status = 'pending'
        AND next_attempt_at <= NOW()
        AND (leased_until IS NULL OR leased_until < NOW())
      ORDER BY next_attempt_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE email_outbox
    SET leased_until = NOW() + (${leaseSeconds}::INT * INTERVAL '1 second')
    WHERE id IN (SELECT id FROM claimable)
    RETURNING id, dedupe_key, to_address, template, payload, attempts, created_at
  `

  return rows.map((r) => ({
    id: r.id,
    dedupeKey: r.dedupe_key,
    toAddress: r.to_address,
    template: r.template,
    payload: r.payload,
    attempts: r.attempts,
    createdAt: r.created_at,
  }))
}

/**
 * Mark a claimed row as successfully sent. Records the provider message id
 * for auditing, releases the lease, and bumps attempts (so the audit trail
 * reflects that a delivery attempt occurred).
 */
export async function markEmailSent(
  databaseUrl: string,
  id: number,
  providerMessageId: string | null
): Promise<void> {
  const db = getDb(databaseUrl)
  await db`
    UPDATE email_outbox
    SET status = 'sent',
        sent_at = NOW(),
        last_attempt_at = NOW(),
        attempts = attempts + 1,
        leased_until = NULL,
        provider_message_id = ${providerMessageId},
        last_error = NULL
    WHERE id = ${id}
  `
}

/**
 * Mark a claimed row as failed. If `attemptsAfter >= maxAttempts` we retire
 * the row (`status = 'failed'`), otherwise we schedule the next attempt via
 * the backoff table. Callers pass the row's pre-attempt count; this function
 * computes the post-attempt count.
 */
export async function markEmailFailed(
  databaseUrl: string,
  id: number,
  params: {
    priorAttempts: number
    error: string
    backoffMinutes: number[]
    maxAttempts: number
  }
): Promise<'retry_scheduled' | 'given_up'> {
  const db = getDb(databaseUrl)
  const attemptsAfter = params.priorAttempts + 1

  if (attemptsAfter >= params.maxAttempts) {
    await db`
      UPDATE email_outbox
      SET status = 'failed',
          attempts = ${attemptsAfter},
          last_attempt_at = NOW(),
          last_error = ${params.error.slice(0, 2000)},
          leased_until = NULL
      WHERE id = ${id}
    `
    return 'given_up'
  }

  // Backoff index: clamp to last entry if we've overshot the table.
  const idx = Math.min(params.priorAttempts, params.backoffMinutes.length - 1)
  const backoffMin = params.backoffMinutes[idx] ?? params.backoffMinutes[params.backoffMinutes.length - 1] ?? 5

  await db`
    UPDATE email_outbox
    SET attempts = ${attemptsAfter},
        last_attempt_at = NOW(),
        last_error = ${params.error.slice(0, 2000)},
        next_attempt_at = NOW() + (${backoffMin}::INT * INTERVAL '1 minute'),
        leased_until = NULL
    WHERE id = ${id}
  `
  return 'retry_scheduled'
}

/**
 * Introspection helper — used by CLI/tests to spot-check queue state.
 */
export async function getOutboxCounts(databaseUrl: string): Promise<{
  pending: number
  sent: number
  failed: number
  leased: number
}> {
  const db = getDb(databaseUrl)
  const [row] = await db<Array<{
    pending: number
    sent: number
    failed: number
    leased: number
  }>>`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'sent')::int    AS sent,
      COUNT(*) FILTER (WHERE status = 'failed')::int  AS failed,
      COUNT(*) FILTER (WHERE status = 'pending' AND leased_until > NOW())::int AS leased
    FROM email_outbox
  `
  return row ?? { pending: 0, sent: 0, failed: 0, leased: 0 }
}
