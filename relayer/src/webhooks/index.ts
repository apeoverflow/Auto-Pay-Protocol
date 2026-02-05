import type { RelayerConfig, WebhookRow, WebhookPayload } from '../types.js'
import { getPendingWebhooks, markWebhookSent, markWebhookFailed } from '../db/webhooks.js'
import { getMerchantWebhookConfig } from '../db/merchants.js'
import { deliverWebhook } from './delivery.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('webhooks')

// Process pending webhooks
async function processPendingWebhooks(config: RelayerConfig): Promise<{ sent: number; failed: number }> {
  const pendingWebhooks = await getPendingWebhooks(config.databaseUrl, 20)

  if (pendingWebhooks.length === 0) {
    return { sent: 0, failed: 0 }
  }

  logger.debug({ count: pendingWebhooks.length }, 'Processing pending webhooks')

  let sent = 0
  let failed = 0

  for (const webhook of pendingWebhooks) {
    // Parse payload to get merchant address
    let payload: WebhookPayload
    try {
      payload = JSON.parse(webhook.payload) as WebhookPayload
    } catch {
      logger.error({ webhookId: webhook.id }, 'Failed to parse webhook payload')
      await markWebhookFailed(config.databaseUrl, webhook.id, config.webhooks.maxRetries)
      failed++
      continue
    }

    // Get merchant webhook config
    const merchantConfig = await getMerchantWebhookConfig(
      config.databaseUrl,
      payload.data.merchant
    )

    if (!merchantConfig) {
      logger.debug(
        { webhookId: webhook.id, merchant: payload.data.merchant },
        'No webhook config for merchant'
      )
      // Mark as failed since no webhook URL configured
      await markWebhookFailed(config.databaseUrl, webhook.id, config.webhooks.maxRetries)
      failed++
      continue
    }

    // Deliver webhook
    const result = await deliverWebhook(
      merchantConfig.webhookUrl,
      webhook.payload,
      merchantConfig.webhookSecret,
      config.webhooks.timeoutMs
    )

    if (result.success) {
      await markWebhookSent(config.databaseUrl, webhook.id)
      sent++
    } else {
      await markWebhookFailed(config.databaseUrl, webhook.id, config.webhooks.maxRetries)
      failed++
    }
  }

  return { sent, failed }
}

// Run webhook sender once
export async function runWebhookSenderOnce(config: RelayerConfig) {
  try {
    const result = await processPendingWebhooks(config)
    if (result.sent > 0 || result.failed > 0) {
      logger.info(result, 'Webhook sender run complete')
    }
    return result
  } catch (error) {
    logger.error({ error }, 'Webhook sender error')
    return { sent: 0, failed: 0 }
  }
}

// Start webhook sender loop
export async function startWebhookSenderLoop(
  config: RelayerConfig,
  signal: AbortSignal
) {
  logger.info('Starting webhook sender loop')

  // Run more frequently than executor since webhooks should be fast
  const intervalMs = 10_000 // 10 seconds

  while (!signal.aborted) {
    try {
      await runWebhookSenderOnce(config)
    } catch (error) {
      logger.error({ error }, 'Webhook sender error')
    }

    await sleep(intervalMs, signal)
  }

  logger.info('Webhook sender loop stopped')
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const timeout = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout)
      resolve()
    }, { once: true })
  })
}
