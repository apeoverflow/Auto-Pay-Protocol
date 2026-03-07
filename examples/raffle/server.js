/**
 * AutoRaffle Server
 *
 * A promotional raffle for the ETHGlobal Spotlight Cannes booth.
 * Visitors subscribe for $1 via AutoPay and enter to win a Ledger Nano X.
 * Entries are tracked automatically via webhooks — no registration form needed.
 *
 * Usage:
 *   WEBHOOK_SECRET=secret node server.js
 */

import express from 'express'
import { config } from './src/config.js'
import { webhookHandler } from './src/webhook-handler.js'
import routes from './src/routes.js'

const app = express()

// Parse JSON, capture raw body for webhook signature verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString()
    },
  })
)

// CORS for frontend
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  next()
})

// ── Webhook endpoint (from AutoPay relayer) ──────────────────
app.post('/webhook', webhookHandler)

// ── API routes ───────────────────────────────────────────────
app.use(routes)

// ── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// ── Start ────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║         AutoRaffle Server             ║
  ╚═══════════════════════════════════════╝

  Chain:        ${config.chainName} (${config.chain.chainId})
  Merchant:     ${config.merchantAddress}
  Port:         ${config.port}
  Entry fee:    ${config.entryFee} USDC
  Webhook:      ${config.webhookSecret ? 'signature verification enabled' : 'WARNING: no secret set'}

  Endpoints:
    POST   /webhook              ← AutoPay relayer webhooks
    GET    /api/entries           → Live entry board
    GET    /api/status            → Raffle info + checkout URL
    GET    /health                → Health check
  `)
})
