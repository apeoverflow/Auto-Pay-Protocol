/**
 * Example: Next.js API route webhook handler
 *
 * File: app/api/webhook/route.ts (App Router)
 *
 * This example shows how to handle AutoPay webhooks in a Next.js API route.
 * Since Next.js App Router gives you the raw Request, you can use verifyWebhook directly.
 */
import { verifyWebhook } from '../src'

const WEBHOOK_SECRET = process.env.AUTOPAY_WEBHOOK_SECRET!

export async function POST(request: Request) {
  // Get raw body text for signature verification
  const rawBody = await request.text()
  const signature = request.headers.get('x-autopay-signature') ?? undefined

  try {
    const event = verifyWebhook(rawBody, signature, WEBHOOK_SECRET)

    switch (event.type) {
      case 'policy.created': {
        // New subscriber — grant access
        const { payer, chargeAmount, metadataUrl } = event.data
        console.log(`New subscriber: ${payer}, plan: ${metadataUrl}`)
        // await db.subscribers.create({ payer, chargeAmount, ... })
        break
      }

      case 'charge.succeeded': {
        // Recurring payment received
        const { payer, amount, txHash } = event.data
        console.log(`Payment from ${payer}: ${amount} (tx: ${txHash})`)
        // await db.payments.create({ payer, amount, txHash })
        break
      }

      case 'charge.failed': {
        // Payment failed — send reminder
        const { payer, reason } = event.data
        console.log(`Payment failed for ${payer}: ${reason}`)
        // await sendPaymentFailedEmail(payer)
        break
      }

      case 'policy.revoked': {
        // User cancelled
        const { payer } = event.data
        console.log(`Subscription cancelled by ${payer}`)
        // await db.subscribers.deactivate({ payer })
        break
      }

      case 'policy.cancelled_by_failure': {
        // Auto-cancelled after repeated failures
        const { payer, consecutiveFailures } = event.data
        console.log(`Auto-cancelled for ${payer} after ${consecutiveFailures} failures`)
        // await db.subscribers.deactivate({ payer, reason: 'payment_failures' })
        break
      }
    }

    return Response.json({ received: true })
  } catch (err) {
    console.error('Webhook verification failed:', err)
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }
}
