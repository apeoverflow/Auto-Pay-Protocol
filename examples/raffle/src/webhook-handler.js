/**
 * AutoPay webhook handler — tracks raffle entries from subscription events.
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { config } from './config.js'
import { addEntry, confirmEntry } from './db.js'

const log = (msg) => console.log(`  [webhook] ${msg}`)

export function verifySignature(payload, signature, secret) {
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  if (expected.length !== signature.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export function webhookHandler(req, res) {
  const signature = req.headers['x-autopay-signature']
  const timestamp = req.headers['x-autopay-timestamp']

  log(`Incoming webhook at ${timestamp || 'unknown'}`)

  if (config.webhookSecret) {
    const rawBody = req.rawBody
    if (!signature || !verifySignature(rawBody, signature, config.webhookSecret)) {
      log('Invalid signature — rejecting')
      return res.status(401).json({ error: 'Invalid signature' })
    }
    log('Signature verified')
  }

  const { event, data } = req.body

  try {
    switch (event) {
      case 'policy.created': {
        const address = data.payer.toLowerCase()
        addEntry(address, data.policyId)
        log(`Entry added for ${address.slice(0, 8)}...`)
        break
      }

      case 'charge.succeeded': {
        const address = data.payer.toLowerCase()
        confirmEntry(address, data.policyId, data.txHash)
        log(`Entry confirmed for ${address.slice(0, 8)}... (${data.txHash.slice(0, 10)}...)`)
        break
      }

      default:
        log(`Ignored event: ${event}`)
    }
  } catch (err) {
    log(`Error handling ${event}: ${err.message}`)
  }

  res.json({ received: true })
}
