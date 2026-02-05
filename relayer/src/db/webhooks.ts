import type { WebhookRow, WebhookPayload, WebhookEventType } from '../types.js'
import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:webhooks')

export async function queueWebhook(
  databaseUrl: string,
  policyId: string,
  eventType: WebhookEventType,
  payload: WebhookPayload,
  chargeId?: number
): Promise<number> {
  const db = getDb(databaseUrl)

  const result = await db`
    INSERT INTO webhooks (policy_id, charge_id, event_type, payload, status)
    VALUES (
      ${policyId},
      ${chargeId ?? null},
      ${eventType},
      ${JSON.stringify(payload)},
      'pending'
    )
    RETURNING id
  `

  const webhookId = result[0].id
  logger.debug({ webhookId, eventType, policyId }, 'Queued webhook')
  return webhookId
}

export async function getPendingWebhooks(
  databaseUrl: string,
  limit: number
): Promise<WebhookRow[]> {
  const db = getDb(databaseUrl)

  const rows = await db<WebhookRow[]>`
    SELECT * FROM webhooks
    WHERE status = 'pending'
      AND next_attempt_at <= NOW()
    ORDER BY created_at ASC
    LIMIT ${limit}
  `

  return rows
}

export async function markWebhookSent(databaseUrl: string, webhookId: number) {
  const db = getDb(databaseUrl)

  await db`
    UPDATE webhooks
    SET
      status = 'sent',
      last_attempt_at = NOW(),
      attempts = attempts + 1
    WHERE id = ${webhookId}
  `

  logger.debug({ webhookId }, 'Marked webhook as sent')
}

export async function markWebhookFailed(
  databaseUrl: string,
  webhookId: number,
  maxRetries: number
) {
  const db = getDb(databaseUrl)

  // Get current attempt count
  const webhook = await db`
    SELECT attempts FROM webhooks WHERE id = ${webhookId}
  `

  const attempts = (webhook[0]?.attempts ?? 0) + 1

  if (attempts >= maxRetries) {
    // Max retries exhausted
    await db`
      UPDATE webhooks
      SET
        status = 'failed',
        last_attempt_at = NOW(),
        attempts = ${attempts}
      WHERE id = ${webhookId}
    `
    logger.warn({ webhookId, attempts }, 'Webhook failed after max retries')
  } else {
    // Schedule next attempt with exponential backoff
    // 1min, 5min, 15min
    const backoffMinutes = [1, 5, 15][attempts - 1] ?? 15
    const nextAttemptAt = new Date(Date.now() + backoffMinutes * 60 * 1000)

    await db`
      UPDATE webhooks
      SET
        last_attempt_at = NOW(),
        next_attempt_at = ${nextAttemptAt},
        attempts = ${attempts}
      WHERE id = ${webhookId}
    `
    logger.debug(
      { webhookId, attempts, nextAttemptAt },
      'Scheduled webhook retry'
    )
  }
}

export async function getWebhook(
  databaseUrl: string,
  webhookId: number
): Promise<WebhookRow | null> {
  const db = getDb(databaseUrl)

  const rows = await db<WebhookRow[]>`
    SELECT * FROM webhooks WHERE id = ${webhookId}
  `

  return rows[0] ?? null
}
