/**
 * Example: AI agent that bridges USDC from another chain before subscribing.
 *
 * Demonstrates two approaches:
 *   1. Manual bridge + subscribe (explicit control)
 *   2. wrapFetchWithSubscription with auto-bridge (zero-boilerplate)
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... \
 *   SOURCE_CHAIN_ID=1 \
 *   SOURCE_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY \
 *   CHAIN=base \
 *   node agent-with-bridge.js
 */

import {
  AutoPayAgent,
  wrapFetchWithSubscription,
  SOURCE_USDC,
} from '@autopayprotocol/agent-sdk'

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY
const SOURCE_CHAIN_ID = Number(process.env.SOURCE_CHAIN_ID || '1')
const SOURCE_RPC_URL = process.env.SOURCE_RPC_URL
const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:4000'

if (!PRIVATE_KEY) {
  console.error('AGENT_PRIVATE_KEY env var is required')
  process.exit(1)
}
if (!SOURCE_RPC_URL) {
  console.error('SOURCE_RPC_URL env var is required (RPC for the source chain)')
  process.exit(1)
}
if (!process.env.MERCHANT_ADDRESS) {
  console.error('MERCHANT_ADDRESS env var is required')
  process.exit(1)
}
if (!SOURCE_USDC[SOURCE_CHAIN_ID]) {
  console.error(`Unsupported source chain ${SOURCE_CHAIN_ID}. Supported: ${Object.keys(SOURCE_USDC).join(', ')}`)
  process.exit(1)
}

const agent = new AutoPayAgent({
  privateKey: PRIVATE_KEY,
  chain: process.env.CHAIN || 'base',
})

console.log(`[agent] Wallet:       ${agent.address}`)
console.log(`[agent] Dest chain:   ${agent.chain.name} (${agent.chain.chainId})`)
console.log(`[agent] Source chain:  ${SOURCE_CHAIN_ID}`)
console.log()

// ── Approach 1: Manual bridge then subscribe ───────────────────

async function manualBridge() {
  console.log('[manual] Bridging 15 USDC from source chain...')

  const result = await agent.bridgeUsdc({
    fromChainId: SOURCE_CHAIN_ID,
    amount: 15,
    sourceRpcUrl: SOURCE_RPC_URL,
    onStatus: (status) => {
      console.log(`[manual]   Bridge status: ${status.step}`)
    },
  })

  console.log(`[manual] Bridge complete in ${(result.durationMs / 1000).toFixed(1)}s`)
  console.log(`[manual]   Source tx: ${result.sourceTxHash}`)
  console.log(`[manual]   Received: ${result.toAmount} USDC`)
  console.log()

  // Now subscribe with funds on the destination chain
  const sub = await agent.subscribe({
    merchant: process.env.MERCHANT_ADDRESS,
    amount: 10,
    interval: 'monthly',
    spendingCap: 120,
  })

  console.log(`[manual] Subscribed! policyId: ${sub.policyId}`)
}

// ── Approach 2: Auto-bridge via wrapFetchWithSubscription ──────

async function autoBridge() {
  const fetchWithPay = wrapFetchWithSubscription(fetch, agent, {
    bridge: {
      fromChainId: SOURCE_CHAIN_ID,
      sourceRpcUrl: SOURCE_RPC_URL,
      extraAmount: 5, // Bridge 5 extra USDC as buffer
      onBridge: (status) => {
        console.log(`[auto]   Bridge: ${status.step}`)
      },
    },
    onSubscribe: (merchant, sub) => {
      console.log(`[auto] Subscribed to ${merchant}`)
      console.log(`[auto]   policyId: ${sub.policyId}`)
    },
  })

  // This single call will: check balance → bridge if needed → subscribe → retry
  const res = await fetchWithPay(`${SERVICE_URL}/api/prices`)
  const data = await res.json()
  console.log(`[auto] GET /api/prices → ${res.status}`)
  console.log(`[auto]   Data:`, data)
}

// Run the auto-bridge approach by default
autoBridge().catch((err) => {
  console.error('[agent] Fatal:', err.message || err)
  process.exit(1)
})
