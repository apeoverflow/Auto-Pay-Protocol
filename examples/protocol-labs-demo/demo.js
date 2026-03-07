/**
 * Protocol Labs Demo Runner
 *
 * Orchestrates the full common goods funding demo:
 *   1. Starts the project registry service
 *   2. Runs the sponsor agent (autonomous project funding)
 *   3. Runs the DAO funder (multi-project treasury allocation)
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... MERCHANT_ADDRESS=0x... node demo.js
 *
 * Options:
 *   CHAIN=baseSepolia|base|flowMainnet  (default: baseSepolia)
 *   REGISTRY_PORT=4100                  (default: 4100)
 *   DEMO_MODE=agent|dao|both            (default: both)
 */

import { spawn } from 'node:child_process'

const required = ['AGENT_PRIVATE_KEY', 'MERCHANT_ADDRESS']
const missing = required.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')}`)
  console.error(`\nUsage:`)
  console.error(`  AGENT_PRIVATE_KEY=0x... MERCHANT_ADDRESS=0x... node demo.js`)
  console.error(`\nOptions:`)
  console.error(`  CHAIN=baseSepolia|base|flowMainnet`)
  console.error(`  DEMO_MODE=agent|dao|both`)
  process.exit(1)
}

const CHAIN = process.env.CHAIN || 'baseSepolia'
const PORT = process.env.REGISTRY_PORT || '4100'
const DEMO_MODE = process.env.DEMO_MODE || 'both'
const REGISTRY_URL = `http://localhost:${PORT}`

console.log(`
  ╔═══════════════════════════════════════════════════════════════╗
  ║                                                               ║
  ║       AutoPay Protocol — Common Goods Funding Demo            ║
  ║       For Protocol Labs                                       ║
  ║                                                               ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║                                                               ║
  ║  This demo shows how AutoPay enables sustainable, recurring   ║
  ║  funding for common goods projects from three perspectives:   ║
  ║                                                               ║
  ║    1. PROJECT REGISTRY                                        ║
  ║       A directory of fundable open-source projects with       ║
  ║       tiered sponsorship plans and HTTP 402 discovery.        ║
  ║                                                               ║
  ║    2. SPONSOR AGENT                                           ║
  ║       An AI agent that autonomously discovers, evaluates,     ║
  ║       and funds the projects it depends on.                   ║
  ║                                                               ║
  ║    3. DAO TREASURY FUNDER                                     ║
  ║       A treasury bot that allocates monthly budget across     ║
  ║       multiple ecosystem dependencies with spending caps.     ║
  ║                                                               ║
  ║  Chain: ${CHAIN.padEnd(12)}  Mode: ${DEMO_MODE.padEnd(8)}                      ║
  ║                                                               ║
  ╚═══════════════════════════════════════════════════════════════╝
`)

// Start the registry service
const registry = spawn('node', ['project-registry.js'], {
  stdio: 'inherit',
  env: { ...process.env, CHAIN, REGISTRY_PORT: PORT },
})

function cleanup() {
  registry.kill()
  process.exit()
}
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
registry.on('close', () => process.exit())

// Wait for registry to be ready
async function waitForRegistry(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${REGISTRY_URL}/api/status`)
      if (res.ok) return
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  console.error('  Registry failed to start')
  cleanup()
}

// Run demo agents sequentially
async function runDemo(scriptName, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'═'.repeat(65)}`)
    console.log(`  Running: ${label}`)
    console.log(`${'═'.repeat(65)}\n`)

    const proc = spawn('node', [scriptName], {
      stdio: 'inherit',
      env: { ...process.env, CHAIN, REGISTRY_URL },
    })

    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${label} exited with code ${code}`))
    })

    proc.on('error', reject)
  })
}

waitForRegistry().then(async () => {
  try {
    if (DEMO_MODE === 'agent' || DEMO_MODE === 'both') {
      await runDemo('sponsor-agent.js', 'Autonomous Sponsor Agent')
    }

    if (DEMO_MODE === 'dao' || DEMO_MODE === 'both') {
      await runDemo('dao-funder.js', 'DAO Treasury Funder')
    }

    console.log(`
  ╔═══════════════════════════════════════════════════════════════╗
  ║                     Demo Complete                             ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║                                                               ║
  ║  What we demonstrated:                                        ║
  ║                                                               ║
  ║  1. DISCOVERY                                                 ║
  ║     Projects publish funding tiers via a registry. Agents     ║
  ║     and wallets discover them via HTTP 402 responses.         ║
  ║                                                               ║
  ║  2. AUTONOMOUS FUNDING                                        ║
  ║     AI agents evaluate projects by impact metrics and         ║
  ║     autonomously subscribe to fund them on-chain.             ║
  ║                                                               ║
  ║  3. TREASURY MANAGEMENT                                       ║
  ║     DAOs allocate budgets across ecosystem dependencies       ║
  ║     with category weights, spending caps, and audit trails.   ║
  ║                                                               ║
  ║  4. SPONSOR PERKS                                             ║
  ║     Subscribers unlock build status feeds, governance         ║
  ║     proposals, and sponsor directories — verified on-chain.   ║
  ║                                                               ║
  ║  5. NON-CUSTODIAL + TRANSPARENT                               ║
  ║     All funding flows through the PolicyManager contract.     ║
  ║     Funds stay in wallets until charged. Every tx is public.  ║
  ║                                                               ║
  ║  Why AutoPay for common goods:                                ║
  ║     - 2.5% fee vs 15-30% grants admin overhead               ║
  ║     - Recurring, not one-time (sustainable)                   ║
  ║     - Agent-native (AI can fund its own dependencies)         ║
  ║     - On-chain spending caps (fiscal control)                 ║
  ║     - Cross-chain (USDC from 30+ chains)                     ║
  ║     - Filecoin-backed metadata + receipts                     ║
  ║                                                               ║
  ╚═══════════════════════════════════════════════════════════════╝
    `)
  } catch (err) {
    console.error(`\n  Demo failed: ${err.message}`)
  } finally {
    cleanup()
  }
})
