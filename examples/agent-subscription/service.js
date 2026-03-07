/**
 * Example: Data service that requires an AutoPay subscription.
 *
 * - GET /api/prices   → 402 if no subscription, 200 with signed Bearer token
 * - GET /api/status   → public health check
 *
 * Uses @autopayprotocol/middleware for signed token verification.
 * Bearer tokens are signed by the subscriber's wallet, proving ownership.
 *
 * Usage:
 *   MERCHANT_ADDRESS=0x... node service.js
 */

import express from 'express'
import { requireSubscription, chains } from '@autopayprotocol/middleware'

// ── Config ──────────────────────────────────────────────────────

const CHAIN = process.env.CHAIN || 'baseSepolia'
const PORT = Number(process.env.SERVICE_PORT) || 4000
const MERCHANT = process.env.MERCHANT_ADDRESS

if (!MERCHANT) {
  console.error('MERCHANT_ADDRESS env var is required')
  process.exit(1)
}

if (!chains[CHAIN]) {
  console.error(`Unknown chain: ${CHAIN}. Use: ${Object.keys(chains).join(', ')}`)
  process.exit(1)
}

// ── Middleware ───────────────────────────────────────────────────

const auth = requireSubscription({
  merchant: MERCHANT,
  chain: CHAIN,
  plans: [
    {
      name: 'Basic',
      amount: '0.01',
      interval: 86400,
      description: 'Real-time price data, 0.01 USDC/day',
    },
    {
      name: 'Pro',
      amount: '0.05',
      interval: 86400,
      description: 'Price data + analytics, 0.05 USDC/day',
    },
  ],
})

// ── Mock data ───────────────────────────────────────────────────

function generatePrices() {
  const base = { BTC: 62000, ETH: 3400, SOL: 145, FLOW: 0.72 }
  const prices = {}
  for (const [token, price] of Object.entries(base)) {
    const jitter = (Math.random() - 0.5) * 0.02 * price
    prices[token] = +(price + jitter).toFixed(2)
  }
  return { prices, timestamp: new Date().toISOString() }
}

// ── Routes ──────────────────────────────────────────────────────

const app = express()

app.get('/api/status', (_req, res) => {
  res.json({
    service: 'Agent Price Feed',
    chain: CHAIN,
    chainId: chains[CHAIN].chainId,
    merchant: MERCHANT,
    status: 'ok',
  })
})

// Allow clients to invalidate cached subscription status (e.g. after cancellation)
app.delete('/api/subscriptions/:policyId', (req, res) => {
  auth.invalidateCache(req.params.policyId)
  res.json({ invalidated: true })
})

app.get('/api/prices', auth, (req, res) => {
  res.json({
    ...generatePrices(),
    subscriber: req.subscriber,
    policyId: req.policyId,
  })
})

app.listen(PORT, () => {
  console.log(`\n  Agent Price Feed Service`)
  console.log(`  ───────────────────────`)
  console.log(`  Chain:    ${CHAIN} (${chains[CHAIN].chainId})`)
  console.log(`  Merchant: ${MERCHANT}`)
  console.log(`  Port:     ${PORT}`)
  console.log(`\n  Endpoints:`)
  console.log(`    GET    /api/status               → public`)
  console.log(`    GET    /api/prices                → requires subscription`)
  console.log(`    DELETE /api/subscriptions/:id     → invalidate cache`)
  console.log()
})
