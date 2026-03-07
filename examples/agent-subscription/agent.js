/**
 * Example: Autonomous AI agent that subscribes to a data service via AutoPay.
 *
 * Flow:
 *   1. Hit the service API → get 402 with subscription options
 *   2. Subscribe (auto-approves USDC if needed, first charge is immediate)
 *   3. Create a signed Bearer token and use the service
 *   4. Cancel subscription when done
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... CHAIN=baseSepolia node agent.js
 *
 * The agent wallet must hold:
 *   - USDC for subscription payments
 *   - Native token (ETH on Base, FLOW on Flow EVM) for gas
 */

import { AutoPayAgent } from '@autopayprotocol/agent-sdk'
import { formatUnits } from 'viem'

// ── Config ──────────────────────────────────────────────────────

const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:4000'
const CHAIN = process.env.CHAIN || 'baseSepolia'
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY

if (!PRIVATE_KEY) {
  console.error('AGENT_PRIVATE_KEY env var is required')
  process.exit(1)
}

const agent = new AutoPayAgent({ privateKey: PRIVATE_KEY, chain: CHAIN })
const log = (msg) => console.log(`  [agent] ${msg}`)

// ── Main agent loop ─────────────────────────────────────────────

async function main() {
  console.log(`\n  ╔═══════════════════════════════════════╗`)
  console.log(`  ║   AutoPay Agent Subscription Demo     ║`)
  console.log(`  ╚═══════════════════════════════════════╝\n`)

  log(`Wallet:  ${agent.address}`)
  log(`Chain:   ${CHAIN} (${agent.chain.chainId})`)
  log(`Service: ${SERVICE_URL}`)

  // Show balances
  const usdcBal = await agent.getBalance()
  const gasBal = await agent.getGasBalance()
  log(`USDC balance:   ${formatUnits(usdcBal, 6)}`)
  log(`Native balance: ${formatUnits(gasBal, 18)}`)

  if (gasBal === 0n) {
    log('No native token for gas — fund the agent wallet first')
    process.exit(1)
  }
  if (usdcBal === 0n) {
    log('No USDC balance — fund the agent wallet first')
    process.exit(1)
  }

  // ── Step 1: Hit the service, expect 402 ─────────────────────
  console.log(`\n  ── Step 1: Discover subscription requirements ──\n`)

  const discoveryRes = await fetch(`${SERVICE_URL}/api/prices`)
  log(`GET /api/prices → ${discoveryRes.status}`)

  if (discoveryRes.status !== 402) {
    log(`Expected 402, got ${discoveryRes.status}. Is the service running?`)
    process.exit(1)
  }

  const discovery = await discoveryRes.json()
  log(`Service accepts: ${discovery.accepts.join(', ')}`)

  const plan = discovery.autopay.plans[0]
  log(`Selected plan: "${plan.name}" — ${plan.amount} ${plan.currency} every ${plan.interval}s`)

  // ── Step 2: Subscribe (auto-approves + creates policy) ──────
  console.log(`\n  ── Step 2: Subscribe (first charge executes immediately) ──\n`)

  const spendingCap = Number(plan.amount) * 30
  const { policyId, txHash } = await agent.subscribe({
    merchant: discovery.autopay.merchant,
    amount: Number(plan.amount),
    interval: plan.interval,
    spendingCap,
  })

  log(`Subscription created!`)
  log(`  policyId: ${policyId}`)
  log(`  explorer: ${agent.chain.explorer}/tx/${txHash}`)

  // ── Step 3: Use the service ─────────────────────────────────
  console.log(`\n  ── Step 3: Use the service with signed Bearer token ──\n`)

  // Create a signed Bearer token — proves wallet ownership to the service
  const bearerToken = await agent.createBearerToken(policyId)
  log(`Signed token: ${bearerToken.slice(0, 30)}...`)

  for (let i = 0; i < 3; i++) {
    const res = await fetch(`${SERVICE_URL}/api/prices`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    })
    log(`GET /api/prices → ${res.status}`)

    if (!res.ok) {
      log(`  Unexpected ${res.status} — expected 200`)
      break
    }

    const data = await res.json()
    log(`  BTC: $${data.prices.BTC}  ETH: $${data.prices.ETH}  SOL: $${data.prices.SOL}`)

    if (i < 2) await new Promise((r) => setTimeout(r, 1000))
  }

  // ── Step 4: Cancel ──────────────────────────────────────────
  console.log(`\n  ── Step 4: Cancel subscription ──\n`)

  await agent.unsubscribe(policyId)
  log(`Subscription cancelled`)

  // Notify the service to invalidate its cache for this policy
  await fetch(`${SERVICE_URL}/api/subscriptions/${policyId}`, { method: 'DELETE' })

  // Verify cancellation — service should return 402 again
  const cancelToken = await agent.createBearerToken(policyId)
  const verifyRes = await fetch(`${SERVICE_URL}/api/prices`, {
    headers: { Authorization: `Bearer ${cancelToken}` },
  })
  log(`POST-cancel GET /api/prices → ${verifyRes.status} (expected 402)`)

  console.log(`\n  ── Demo complete ──\n`)
}

main().catch((err) => {
  console.error('\n  [agent] Fatal error:', err.message || err)
  process.exit(1)
})
