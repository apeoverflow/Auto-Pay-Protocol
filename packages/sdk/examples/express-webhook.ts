/**
 * Express webhook handler.
 *
 * Register this endpoint as your webhook URL with the relayer.
 * Important: use express.text() instead of express.json() so the
 * raw body is available for signature verification.
 */
import express from 'express'
import { verifyWebhook } from '@autopayprotocol/sdk'

const app = express()
const WEBHOOK_SECRET = process.env.AUTOPAY_WEBHOOK_SECRET!

// Parse the body as raw text — needed for HMAC verification.
// If you use express.json(), the re-stringified body won't match the signature.
app.post('/webhook/autopay', express.text({ type: '*/*' }), (req, res) => {
  const signature = req.headers['x-autopay-signature'] as string | undefined

  try {
    const event = verifyWebhook(req.body, signature, WEBHOOK_SECRET)

    switch (event.type) {
      case 'policy.created':
        console.log(`New subscriber: ${event.data.payer}`)
        // Grant access
        break

      case 'charge.succeeded':
        console.log(`Payment: ${event.data.amount} from ${event.data.payer}`)
        // Record payment
        break

      case 'charge.failed':
        console.log(`Failed: ${event.data.payer} — ${event.data.reason}`)
        // Send reminder
        break

      case 'policy.revoked':
        console.log(`Cancelled: ${event.data.payer}`)
        // Revoke access
        break

      case 'policy.cancelled_by_failure':
        console.log(`Auto-cancelled: ${event.data.payer}`)
        // Revoke access
        break
    }

    res.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    res.status(401).json({ error: 'Invalid signature' })
  }
})

app.listen(3000, () => console.log('Listening on :3000'))
