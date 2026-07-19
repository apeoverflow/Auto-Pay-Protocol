import { Resend } from 'resend'
import type { RelayerConfig } from '../types.js'
import { claimPendingEmails, markEmailFailed, markEmailSent, type OutboxRow } from '../db/email-outbox.js'
import { verifyEmail, type VerifyEmailParams } from './templates/verify.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('email-sender')

let resend: Resend | null = null

function getResend(): Resend {
  if (!resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY not configured')
    resend = new Resend(key)
  }
  return resend
}

const FROM_ADDRESS = process.env.RESEND_FROM || 'AutoPay <noreply@autopayprotocol.com>'

/**
 * Renders an outbox row into a Resend `send()` payload. Kept as an
 * exhaustive switch so a template rename or missing template is a compile
 * error, not a silent skip at runtime.
 */
function renderOutboxRow(row: OutboxRow): {
  subject: string
  html: string
  text: string
} | null {
  switch (row.template) {
    case 'email_verify':
      return verifyEmail(row.payload as unknown as VerifyEmailParams)
    case 'low_approval':
      // Populated in stage 3.
      return null
    case 'approval_recovered':
      // Populated in stage 3.
      return null
    default: {
      const _exhaustive: never = row.template
      return _exhaustive
    }
  }
}

/**
 * A single tick: claim a batch, dispatch each row, mark outcomes. Returns
 * the number of rows processed (useful for tests).
 */
export async function runEmailSenderOnce(config: RelayerConfig): Promise<number> {
  const rows = await claimPendingEmails(
    config.databaseUrl,
    config.emailSender.batchSize,
    config.emailSender.leaseSeconds
  )
  if (rows.length === 0) return 0

  logger.debug({ count: rows.length }, 'Claimed email rows for send')

  const client = getResend()

  for (const row of rows) {
    const rendered = renderOutboxRow(row)
    if (!rendered) {
      // A template that isn't wired up yet (e.g. low_approval before stage 3).
      // Mark failed so we don't infinite-loop on it; the outbox row is retained
      // for diagnostics.
      logger.warn({ id: row.id, template: row.template }, 'No renderer for template — marking failed')
      await markEmailFailed(config.databaseUrl, row.id, {
        priorAttempts: row.attempts,
        error: `No renderer for template "${row.template}"`,
        backoffMinutes: config.emailSender.backoffMinutes,
        maxAttempts: config.emailSender.maxAttempts,
      })
      continue
    }

    try {
      const { data, error } = await client.emails.send(
        {
          from: FROM_ADDRESS,
          to: row.toAddress,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        },
        { idempotencyKey: row.dedupeKey }
      )

      if (error) {
        const errMsg = typeof error === 'string' ? error : (error as { message?: string }).message ?? JSON.stringify(error)
        const outcome = await markEmailFailed(config.databaseUrl, row.id, {
          priorAttempts: row.attempts,
          error: errMsg,
          backoffMinutes: config.emailSender.backoffMinutes,
          maxAttempts: config.emailSender.maxAttempts,
        })
        logger.warn(
          { id: row.id, template: row.template, to: row.toAddress, error: errMsg, outcome },
          'Resend rejected email'
        )
      } else {
        await markEmailSent(config.databaseUrl, row.id, data?.id ?? null)
        logger.info(
          { id: row.id, template: row.template, to: row.toAddress, providerMessageId: data?.id },
          'Email sent'
        )
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const outcome = await markEmailFailed(config.databaseUrl, row.id, {
        priorAttempts: row.attempts,
        error: errMsg,
        backoffMinutes: config.emailSender.backoffMinutes,
        maxAttempts: config.emailSender.maxAttempts,
      })
      logger.error(
        { id: row.id, template: row.template, to: row.toAddress, err, outcome },
        'Exception sending email'
      )
    }
  }

  return rows.length
}

/**
 * Long-running sender loop. Feature-flagged: absent RESEND_API_KEY or
 * `emailSender.enabled=false` means the loop logs once and returns
 * (matching the Storacha pattern).
 */
export async function startEmailSenderLoop(
  config: RelayerConfig,
  signal: AbortSignal
): Promise<void> {
  if (!config.emailSender.enabled) {
    logger.info('Email sender disabled (emailSender.enabled=false) — skipping')
    return
  }
  if (!process.env.RESEND_API_KEY) {
    logger.warn('Email sender enabled but RESEND_API_KEY is not set — skipping')
    return
  }

  logger.info(
    { intervalMs: config.emailSender.runIntervalMs, batchSize: config.emailSender.batchSize },
    'Starting email sender loop'
  )

  while (!signal.aborted) {
    try {
      await runEmailSenderOnce(config)
    } catch (err) {
      logger.error({ err }, 'Email sender tick failed')
    }
    await sleep(config.emailSender.runIntervalMs, signal)
  }

  logger.info('Email sender loop stopped')
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const timeout = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timeout)
      resolve()
    }, { once: true })
  })
}
