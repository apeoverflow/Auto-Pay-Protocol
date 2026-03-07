/**
 * Example: Autonomous AI agent using wrapFetchWithSubscription.
 *
 * This is the zero-boilerplate version. The wrapped fetch automatically:
 *   - Detects 402 responses with AutoPay discovery bodies
 *   - Subscribes to the merchant (auto-approves USDC if needed)
 *   - Retries with a signed Bearer token (proves wallet ownership)
 *   - Reuses cached subscriptions for subsequent requests
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... CHAIN=baseSepolia node agent-wrapped.js
 */

import { AutoPayAgent, wrapFetchWithSubscription } from '@autopayprotocol/agent-sdk'

const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:4000'
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY

if (!PRIVATE_KEY) {
  console.error('AGENT_PRIVATE_KEY env var is required')
  process.exit(1)
}

const agent = new AutoPayAgent({
  privateKey: PRIVATE_KEY,
  chain: process.env.CHAIN || 'baseSepolia',
})

// Wrap fetch — every 402 with an autopay body is handled transparently
const fetchWithPay = wrapFetchWithSubscription(fetch, agent, {
  onSubscribe: (merchant, sub) => {
    console.log(`[agent] Subscribed to ${merchant}`)
    console.log(`[agent]   policyId: ${sub.policyId}`)
    console.log(`[agent]   tx: ${agent.chain.explorer}/tx/${sub.txHash}`)
  },
  onReuse: (merchant, policyId) => {
    console.log(`[agent] Reusing subscription for ${merchant}: ${policyId.slice(0, 18)}...`)
  },
})

// That's it. Just fetch — the 402 is handled automatically.
async function main() {
  console.log(`[agent] Wallet: ${agent.address}`)
  console.log(`[agent] Chain:  ${agent.chain.name} (${agent.chain.chainId})`)
  console.log()

  // First request triggers subscription
  const res = await fetchWithPay(`${SERVICE_URL}/api/prices`)
  const data = await res.json()
  console.log(`[agent] GET /api/prices → ${res.status}`)
  console.log(`[agent]   BTC: $${data.prices.BTC}  ETH: $${data.prices.ETH}`)

  // Second request reuses cached subscription — no on-chain calls
  const res2 = await fetchWithPay(`${SERVICE_URL}/api/prices`)
  const data2 = await res2.json()
  console.log(`[agent] GET /api/prices → ${res2.status}`)
  console.log(`[agent]   BTC: $${data2.prices.BTC}  ETH: $${data2.prices.ETH}`)
}

main().catch((err) => {
  console.error('[agent] Fatal:', err.message || err)
  process.exit(1)
})
