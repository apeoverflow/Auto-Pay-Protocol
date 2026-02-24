/**
 * Next.js App Router webhook handler.
 *
 * File: app/api/autopay/route.ts
 *
 * Register this URL as your webhook endpoint with the relayer.
 * The relayer sends POST requests with an HMAC-SHA256 signature
 * in the x-autopay-signature header.
 */
import { verifyWebhook } from '@autopayprotocol/sdk'

const WEBHOOK_SECRET = process.env.AUTOPAY_WEBHOOK_SECRET!

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-autopay-signature') ?? undefined

  try {
    // verifyWebhook checks the HMAC signature and parses the event.
    // It throws AutoPayWebhookError if the signature is invalid.
    const event = verifyWebhook(rawBody, signature, WEBHOOK_SECRET)

    switch (event.type) {
      case 'policy.created': {
        // A user just subscribed. Grant access to your product.
        const { payer, merchant, chargeAmount, metadataUrl } = event.data
        console.log(`New subscriber: ${payer} to ${merchant}`)
        console.log(`  Amount: ${chargeAmount}, Plan: ${metadataUrl}`)
        // await db.subscribers.create({ walletAddress: payer, ... })
        break
      }

      case 'charge.succeeded': {
        // Recurring payment collected. Update your records.
        const { payer, amount, protocolFee, txHash } = event.data
        console.log(`Payment: ${amount} from ${payer} (fee: ${protocolFee}, tx: ${txHash})`)
        // await db.payments.record({ payer, amount, txHash })
        break
      }

      case 'charge.failed': {
        // Payment failed (insufficient balance or allowance).
        // The relayer retries up to 3 times before auto-cancelling.
        const { payer, reason } = event.data
        console.log(`Payment failed for ${payer}: ${reason}`)
        // await sendPaymentReminderEmail(payer)
        break
      }

      case 'policy.revoked': {
        // User cancelled their subscription.
        const { payer } = event.data
        console.log(`Cancelled by user: ${payer}`)
        // await db.subscribers.deactivate(payer)
        break
      }

      case 'policy.cancelled_by_failure': {
        // Auto-cancelled after 3 consecutive payment failures.
        const { payer, consecutiveFailures } = event.data
        console.log(`Auto-cancelled: ${payer} after ${consecutiveFailures} failures`)
        // await db.subscribers.deactivate(payer)
        break
      }

      case 'policy.completed': {
        // Spending cap reached — subscription fulfilled.
        const { payer, totalSpent, chargeCount } = event.data
        console.log(`Completed: ${payer} spent ${totalSpent} over ${chargeCount} charges`)
        // await db.subscribers.markCompleted(payer)
        break
      }
    }

    return Response.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }
}
