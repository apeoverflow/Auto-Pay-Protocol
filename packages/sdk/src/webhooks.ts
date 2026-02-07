import { createHmac } from 'crypto'
import { AutoPayWebhookError } from './errors'
import type { WebhookEvent, WebhookEventType } from './types'

const VALID_EVENT_TYPES: WebhookEventType[] = [
  'charge.succeeded',
  'charge.failed',
  'policy.created',
  'policy.revoked',
  'policy.cancelled_by_failure',
]

/**
 * Sign a payload string with HMAC-SHA256.
 * Used by the relayer — exposed here so merchants can test locally.
 */
export function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Verify an HMAC-SHA256 signature using constant-time comparison.
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = signPayload(payload, secret)
  return timingSafeEqual(expected, signature)
}

/**
 * Verify and parse a webhook from AutoPay.
 *
 * @param rawBody  - The raw request body string (JSON.stringify of the body)
 * @param signature - The `x-autopay-signature` header value
 * @param secret   - Your webhook secret
 * @returns A fully-typed {@link WebhookEvent} with discriminated union on `type`
 *
 * @example
 * ```ts
 * const event = verifyWebhook(rawBody, req.headers['x-autopay-signature'], secret)
 * if (event.type === 'charge.succeeded') {
 *   console.log(event.data.amount) // TypeScript knows this exists
 * }
 * ```
 */
export function verifyWebhook(rawBody: string, signature: string | undefined, secret: string): WebhookEvent {
  if (!signature) {
    throw new AutoPayWebhookError('Missing x-autopay-signature header')
  }

  if (!secret) {
    throw new AutoPayWebhookError('Webhook secret is not configured')
  }

  if (!verifySignature(rawBody, signature, secret)) {
    throw new AutoPayWebhookError('Invalid webhook signature')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    throw new AutoPayWebhookError('Invalid JSON in webhook body')
  }

  const event = parsed as Record<string, unknown>

  if (!event || typeof event !== 'object') {
    throw new AutoPayWebhookError('Webhook body is not an object')
  }

  // The relayer sends { event: "charge.succeeded", timestamp: "...", data: { ... } }
  // Normalize to our SDK type shape: { type: "charge.succeeded", ... }
  const eventType = (event.event ?? event.type) as string
  if (!eventType || !VALID_EVENT_TYPES.includes(eventType as WebhookEventType)) {
    throw new AutoPayWebhookError(`Unknown webhook event type: ${eventType}`)
  }

  return {
    type: eventType,
    timestamp: event.timestamp,
    data: event.data,
  } as WebhookEvent
}

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
