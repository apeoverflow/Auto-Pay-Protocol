import 'dotenv/config'
import express from 'express'
import { verifyWebhook } from '@autopayprotocol/sdk'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Configuration ──
const PORT = process.env.PORT || 3002
const MERCHANT_ADDRESS = process.env.MERCHANT_ADDRESS || '0x2B8b9182c1c3A9bEf4a60951D9B7F49420D12B9B'
const CHECKOUT_URL = process.env.CHECKOUT_URL || 'http://localhost:5173/checkout'
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-secret-123'
const RELAYER_URL = process.env.RELAYER_URL || 'http://localhost:3420'
const ARC_RPC = process.env.ARC_RPC || 'https://rpc.testnet.arc.network'
const POLICY_MANAGER = '0xe3463a10Cb69D9705A38cECac3cBC58AD76f5De1'

// Supabase connection (same DB as relayer, merchant tables)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jlafnlrurqqalgvxshgz.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_KEY || ''
const supabase = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null

const app = express()

// CORS
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  next()
})

app.use(express.json())
app.use(express.static(join(__dirname, 'public')))

// =====================================================================
//  AUTH MIDDLEWARE — Verifies Supabase JWT from Authorization header
// =====================================================================

async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }

  const token = authHeader.slice(7)
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Token verification failed' })
  }
}

// ── GET /api/me — current user info ──
app.get('/api/me', verifyAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email })
})

// ── POST /api/claim-policy — link a policy to the authenticated user ──
app.post('/api/claim-policy', verifyAuth, async (req, res) => {
  const { policy_id, tx_hash } = req.body
  if (!policy_id) {
    return res.status(400).json({ error: 'Missing policy_id' })
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  // Verify the transaction on-chain first
  if (tx_hash) {
    try {
      const rpcRes = await fetch(ARC_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'eth_getTransactionReceipt',
          params: [tx_hash],
        }),
      })
      const { result: receipt } = await rpcRes.json()
      if (!receipt || receipt.status !== '0x1') {
        return res.status(400).json({ error: 'Transaction not confirmed on-chain' })
      }
    } catch {
      // Non-fatal: allow claim even if RPC is down
      console.log('Warning: could not verify tx on-chain during claim')
    }
  }

  // Check if policy already exists
  const { data: existing } = await supabase
    .from('merchant_subscribers')
    .select('policy_id, user_id')
    .eq('policy_id', policy_id)
    .single()

  if (existing) {
    if (existing.user_id && existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Policy already claimed by another user' })
    }
    // Claim it
    await supabase.from('merchant_subscribers')
      .update({ user_id: req.user.id, updated_at: new Date().toISOString() })
      .eq('policy_id', policy_id)
  } else {
    // Webhook hasn't arrived yet — create a placeholder
    await supabase.from('merchant_subscribers').insert({
      policy_id,
      payer_address: '',
      user_id: req.user.id,
      status: 'active',
      access_granted: true,
      charge_amount: '0',
      interval_seconds: 0,
      subscribed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  console.log(`🔗 Policy ${policy_id.slice(0, 10)}... claimed by user ${req.user.email}`)
  res.json({ claimed: true })
})

// =====================================================================
//  WEBHOOK HANDLER — This is the core merchant integration logic.
//
//  The AutoPay relayer sends webhooks for subscription lifecycle events.
//  Your backend should update your own database to track subscriber
//  status, grant/revoke access, and handle payment failures.
//
//  Events:
//    policy.created        → New subscriber signed up (first charge already succeeded)
//    charge.succeeded      → Recurring payment received
//    charge.failed         → Payment failed (balance/allowance issue)
//    policy.revoked        → Subscriber cancelled
//    policy.cancelled_by_failure → Auto-cancelled after 3 consecutive failures
// =====================================================================

app.post('/webhook', async (req, res) => {
  const timestamp = req.headers['x-autopay-timestamp']

  console.log(`\n📨 Webhook received at ${timestamp}`)

  // Step 1: Verify webhook signature using @autopayprotocol/sdk
  let event, data
  if (WEBHOOK_SECRET) {
    try {
      const payload = JSON.stringify(req.body)
      const signature = req.headers['x-autopay-signature']
      const verified = verifyWebhook(payload, signature, WEBHOOK_SECRET)
      event = verified.type
      data = verified.data
      console.log('✓ Signature verified')
    } catch (err) {
      console.log('⚠️  Invalid signature — rejecting')
      return res.status(401).json({ error: err.message })
    }
  } else {
    // No secret configured — parse without verification (dev only)
    event = req.body.event
    data = req.body.data
  }

  console.log(`📥 Event: ${event}`)

  // Step 2: Handle each event type
  try {
    switch (event) {

      // ── New subscriber ──
      // First charge already succeeded within createPolicy().
      // Create a record and grant access immediately.
      case 'policy.created': {
        console.log(`🆕 New subscriber: ${data.payer} (${Number(data.chargeAmount) / 1e6} USDC)`)

        if (supabase) {
          // Check if a placeholder already exists (from claim-policy)
          const { data: existingRow } = await supabase
            .from('merchant_subscribers')
            .select('user_id')
            .eq('policy_id', data.policyId)
            .single()

          const upsertData = {
            policy_id: data.policyId,
            payer_address: data.payer.toLowerCase(),
            plan_id: data.metadataUrl || null,
            status: 'active',
            access_granted: true,
            charge_amount: data.chargeAmount,
            interval_seconds: data.interval,
            total_charges: 1,
            total_paid: data.chargeAmount,
            last_charge_at: new Date().toISOString(),
            next_charge_expected_at: new Date(Date.now() + data.interval * 1000).toISOString(),
            consecutive_failures: 0,
            subscribed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          // Preserve user_id if already claimed
          if (existingRow?.user_id) {
            upsertData.user_id = existingRow.user_id
          }

          await supabase.from('merchant_subscribers').upsert(upsertData, { onConflict: 'policy_id' })
        }
        break
      }

      // ── Recurring charge succeeded ──
      // Update charge count, reset failures, extend access.
      case 'charge.succeeded': {
        const amount = Number(data.amount) / 1e6
        console.log(`✅ Payment received: ${amount} USDC from ${data.payer}`)

        if (supabase) {
          // Fetch current record to increment counters
          const { data: sub } = await supabase
            .from('merchant_subscribers')
            .select('total_charges, total_paid, interval_seconds, status')
            .eq('policy_id', data.policyId)
            .single()

          if (sub) {
            // Skip if policy was already cancelled/expired — prevents race condition
            // where a final charge webhook arrives after the revocation webhook
            if (sub.status === 'cancelled' || sub.status === 'expired') {
              console.log(`⏭️  Skipping charge update for ${data.policyId} — already ${sub.status}`)
              break
            }
            const newTotal = BigInt(sub.total_paid) + BigInt(data.amount)
            await supabase.from('merchant_subscribers')
              .update({
                status: 'active',
                access_granted: true,
                total_charges: sub.total_charges + 1,
                total_paid: newTotal.toString(),
                last_charge_at: new Date().toISOString(),
                next_charge_expected_at: new Date(Date.now() + sub.interval_seconds * 1000).toISOString(),
                consecutive_failures: 0,
                last_failure_reason: null,
                updated_at: new Date().toISOString(),
              })
              .eq('policy_id', data.policyId)
              .not('status', 'in', '("cancelled","expired")')
          }
        }
        break
      }

      // ── Charge failed ──
      // User may have insufficient balance or revoked allowance.
      // Increment failure count. Consider a grace period before revoking access.
      case 'charge.failed': {
        console.log(`❌ Payment failed for ${data.policyId}: ${data.reason}`)

        if (supabase) {
          const { data: sub } = await supabase
            .from('merchant_subscribers')
            .select('consecutive_failures, status')
            .eq('policy_id', data.policyId)
            .single()

          if (sub) {
            // Skip if policy was already cancelled/expired — prevents race condition
            if (sub.status === 'cancelled' || sub.status === 'expired') {
              console.log(`⏭️  Skipping failure update for ${data.policyId} — already ${sub.status}`)
              break
            }
            const failures = sub.consecutive_failures + 1
            // Grace period: revoke access after 2+ consecutive failures
            const revokeAccess = failures >= 2

            await supabase.from('merchant_subscribers')
              .update({
                status: 'past_due',
                access_granted: !revokeAccess,
                consecutive_failures: failures,
                last_failure_reason: data.reason || 'Unknown',
                updated_at: new Date().toISOString(),
              })
              .eq('policy_id', data.policyId)
              .not('status', 'in', '("cancelled","expired")')

            if (revokeAccess) {
              console.log(`🔒 Access revoked for ${data.policyId} after ${failures} failures`)
            }
          }
        }
        break
      }

      // ── Subscriber cancelled ──
      // User voluntarily cancelled. Revoke access immediately
      // (or at end of billing period — your choice).
      case 'policy.revoked': {
        console.log(`🚫 Subscription cancelled: ${data.payer}`)

        if (supabase) {
          await supabase.from('merchant_subscribers')
            .update({
              status: 'cancelled',
              access_granted: false,
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('policy_id', data.policyId)
        }
        break
      }

      // ── Auto-cancelled after repeated failures ──
      // The relayer cancelled the policy after 3 consecutive charge failures.
      case 'policy.cancelled_by_failure': {
        console.log(`💀 Auto-cancelled: ${data.policyId} (${data.consecutiveFailures} failures)`)

        if (supabase) {
          await supabase.from('merchant_subscribers')
            .update({
              status: 'expired',
              access_granted: false,
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('policy_id', data.policyId)
        }
        break
      }

      default:
        console.log(`❓ Unknown event: ${event}`)
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message)
    // Still return 200 so the relayer doesn't retry
  }

  res.json({ received: true })
})

// =====================================================================
//  ACCESS CHECK API — Used by the frontend to gate content.
//
//  In production, you'd check a session/JWT, not a policy_id query param.
//  This demo uses policy_id for simplicity.
// =====================================================================

app.get('/api/check-access', async (req, res) => {
  const { policy_id } = req.query

  if (!supabase) {
    return res.json({ access: false, reason: 'Database not configured' })
  }

  // If Bearer token provided, look up by user_id
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7)
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (!error && user) {
        const { data: sub } = await supabase
          .from('merchant_subscribers')
          .select('policy_id, status, access_granted, payer_address, plan_id, total_charges, last_charge_at, next_charge_expected_at')
          .eq('user_id', user.id)
          .eq('access_granted', true)
          .order('subscribed_at', { ascending: false })
          .limit(1)
          .single()

        if (sub) {
          return res.json({
            access: sub.access_granted,
            status: sub.status,
            subscriber: sub.payer_address,
            plan: sub.plan_id,
            policyId: sub.policy_id,
            totalCharges: sub.total_charges,
            lastCharge: sub.last_charge_at,
            nextCharge: sub.next_charge_expected_at,
          })
        }

        return res.json({ access: false, reason: 'No active subscription for this account' })
      }
    } catch {
      // Fall through to policy_id lookup
    }
  }

  // Fallback: look up by policy_id (legacy / backward compat)
  if (!policy_id) {
    return res.json({ access: false, reason: 'No subscription' })
  }

  const { data: sub } = await supabase
    .from('merchant_subscribers')
    .select('status, access_granted, payer_address, plan_id, total_charges, last_charge_at, next_charge_expected_at')
    .eq('policy_id', policy_id)
    .single()

  if (!sub) {
    return res.json({ access: false, reason: 'Subscription not found' })
  }

  return res.json({
    access: sub.access_granted,
    status: sub.status,
    subscriber: sub.payer_address,
    plan: sub.plan_id,
    totalCharges: sub.total_charges,
    lastCharge: sub.last_charge_at,
    nextCharge: sub.next_charge_expected_at,
  })
})

// =====================================================================
//  EXISTING ROUTES (plans, checkout, verification)
// =====================================================================

// ── Plans endpoint ──
app.get('/api/plans', async (_req, res) => {
  try {
    const listRes = await fetch(`${RELAYER_URL}/metadata`)
    if (!listRes.ok) throw new Error(`Relayer returned ${listRes.status}`)
    const list = await listRes.json()

    const merchantPlans = list.filter(
      (p) => p.merchantAddress?.toLowerCase() === MERCHANT_ADDRESS.toLowerCase()
    )

    const plans = await Promise.all(
      merchantPlans.map(async (entry) => {
        const metaRes = await fetch(`${RELAYER_URL}/metadata/${entry.id}`)
        if (!metaRes.ok) return null
        const metadata = await metaRes.json()
        return { id: entry.id, metadata, metadataUrl: `${RELAYER_URL}/metadata/${entry.id}` }
      })
    )

    res.json(plans.filter(Boolean))
  } catch (err) {
    console.error('Failed to fetch plans:', err.message)
    res.status(502).json({ error: 'Failed to fetch plans', details: err.message })
  }
})

// ── Config endpoint ──
app.get('/api/config', (_req, res) => {
  res.json({
    merchantAddress: MERCHANT_ADDRESS,
    checkoutUrl: CHECKOUT_URL,
    relayerUrl: RELAYER_URL,
  })
})

// ── Verify policy on-chain ──
app.get('/api/verify-policy', async (req, res) => {
  const { policy_id, tx_hash } = req.query

  if (!policy_id || !tx_hash) {
    return res.status(400).json({ verified: false, reason: 'Missing policy_id or tx_hash' })
  }

  try {
    const rpcRes = await fetch(ARC_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'eth_getTransactionReceipt',
        params: [tx_hash],
      }),
    })
    const { result: receipt } = await rpcRes.json()

    if (!receipt) return res.json({ verified: false, reason: 'Transaction not found' })
    if (receipt.status !== '0x1') return res.json({ verified: false, reason: 'Transaction reverted' })

    const policyManagerLogs = receipt.logs.filter(
      (log) => log.address.toLowerCase() === POLICY_MANAGER.toLowerCase()
    )
    if (policyManagerLogs.length === 0) {
      return res.json({ verified: false, reason: 'No PolicyManager events in transaction' })
    }

    const policyIdNormalized = policy_id.toLowerCase()
    const matchingLog = policyManagerLogs.find((log) =>
      log.topics.some((topic) => topic.toLowerCase() === policyIdNormalized)
    )
    if (!matchingLog) {
      return res.json({ verified: false, reason: 'Policy ID not found in transaction logs' })
    }

    console.log(`✅ Policy verified on-chain: ${policy_id}`)
    res.json({ verified: true })
  } catch (err) {
    console.error('Verification failed:', err.message)
    res.status(500).json({ verified: false, reason: 'Verification request failed' })
  }
})

// ── Static pages ──
app.get('/login', (_req, res) => res.sendFile(join(__dirname, 'public', 'login.html')))
app.get('/success', (_req, res) => res.sendFile(join(__dirname, 'public', 'success.html')))
app.get('/cancel', (_req, res) => res.sendFile(join(__dirname, 'public', 'cancel.html')))
app.get('/content', (_req, res) => res.sendFile(join(__dirname, 'public', 'content.html')))
app.get('/', (_req, res) => res.sendFile(join(__dirname, 'public', 'index.html')))

// ── Start ──
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║          AutoPay Merchant Server (Demo)                  ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Home:     http://localhost:${PORT}                         ║
║  Merchant: ${MERCHANT_ADDRESS}    ║
║  Checkout: ${CHECKOUT_URL}                ║
║  Relayer:  ${RELAYER_URL}                         ║
║  Supabase: ${supabase ? 'Connected' : 'Not configured (set SUPABASE_KEY)'}${supabase ? '                         ' : ''}            ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `)
})
