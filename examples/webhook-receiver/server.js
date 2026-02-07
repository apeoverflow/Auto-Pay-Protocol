import { createServer } from 'http'
import { createHmac } from 'crypto'

// Configuration
const PORT = 3500
const WEBHOOK_SECRET = 'test-secret-123' // Must match what's in relayer's merchants table

// Verify webhook signature
function verifySignature(payload, signature, secret) {
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return expected === signature
}

// Handle webhook events
function handleWebhook(event, data) {
  console.log('\n' + '='.repeat(60))
  console.log(`📥 WEBHOOK RECEIVED: ${event}`)
  console.log('='.repeat(60))

  switch (event) {
    case 'charge.succeeded':
      console.log('✅ Payment collected!')
      console.log(`   Policy ID: ${data.policyId}`)
      console.log(`   Payer: ${data.payer}`)
      console.log(`   Amount: ${data.amount} (${Number(data.amount) / 1e6} USDC)`)
      console.log(`   Protocol Fee: ${data.protocolFee}`)
      console.log(`   Tx Hash: ${data.txHash}`)
      // TODO: Grant access to your product/service
      break

    case 'charge.failed':
      console.log('❌ Payment failed!')
      console.log(`   Policy ID: ${data.policyId}`)
      console.log(`   Payer: ${data.payer}`)
      console.log(`   Reason: ${data.reason}`)
      // TODO: Maybe notify user, revoke access after grace period
      break

    case 'policy.created':
      console.log('🆕 New subscription!')
      console.log(`   Policy ID: ${data.policyId}`)
      console.log(`   Payer: ${data.payer}`)
      console.log(`   Amount: ${data.chargeAmount} (${Number(data.chargeAmount) / 1e6} USDC)`)
      console.log(`   Interval: ${data.interval} seconds`)
      // TODO: Create user account, grant initial access
      break

    case 'policy.revoked':
      console.log('🚫 Subscription cancelled!')
      console.log(`   Policy ID: ${data.policyId}`)
      console.log(`   Payer: ${data.payer}`)
      // TODO: Revoke access at end of billing period
      break

    default:
      console.log('❓ Unknown event type')
      console.log(data)
  }

  console.log('='.repeat(60) + '\n')
}

// Create HTTP server
const server = createServer((req, res) => {
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  // Webhook endpoint
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = ''

    req.on('data', chunk => {
      body += chunk.toString()
    })

    req.on('end', () => {
      // Get signature from header
      const signature = req.headers['x-autopay-signature']
      const timestamp = req.headers['x-autopay-timestamp']

      console.log(`\n📨 Incoming webhook at ${timestamp}`)

      // Verify signature (optional but recommended)
      if (WEBHOOK_SECRET !== 'your-webhook-secret-here') {
        if (!signature || !verifySignature(body, signature, WEBHOOK_SECRET)) {
          console.log('⚠️  Invalid signature - rejecting webhook')
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid signature' }))
          return
        }
        console.log('✓ Signature verified')
      } else {
        console.log('⚠️  Signature verification skipped (no secret configured)')
      }

      // Parse payload
      try {
        const payload = JSON.parse(body)
        handleWebhook(payload.event, payload.data)

        // Always respond 200 to acknowledge receipt
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ received: true }))
      } catch (err) {
        console.error('❌ Failed to parse webhook payload:', err.message)
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })

    return
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           AutoPay Webhook Receiver Started                 ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Webhook URL: http://localhost:${PORT}/webhook                ║
║  Health:      http://localhost:${PORT}/health                 ║
║                                                            ║
║  Waiting for webhooks from the relayer...                  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `)
})
