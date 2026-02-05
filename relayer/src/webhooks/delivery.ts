import { signWebhookPayload } from './signer.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('webhooks:delivery')

export interface DeliveryResult {
  success: boolean
  statusCode?: number
  error?: string
}

// Deliver a webhook to a merchant
export async function deliverWebhook(
  url: string,
  payload: string,
  secret: string,
  timeoutMs: number
): Promise<DeliveryResult> {
  const signature = signWebhookPayload(payload, secret)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AutoPay-Signature': signature,
        'X-AutoPay-Timestamp': new Date().toISOString(),
      },
      body: payload,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      logger.debug({ url, statusCode: response.status }, 'Webhook delivered')
      return { success: true, statusCode: response.status }
    } else {
      logger.warn(
        { url, statusCode: response.status },
        'Webhook delivery failed with non-2xx status'
      )
      return {
        success: false,
        statusCode: response.status,
        error: `HTTP ${response.status}`,
      }
    }
  } catch (error) {
    clearTimeout(timeoutId)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn({ url, timeoutMs }, 'Webhook delivery timed out')
      return { success: false, error: 'Timeout' }
    }

    logger.error({ url, error: errorMessage }, 'Webhook delivery error')
    return { success: false, error: errorMessage }
  }
}
