/**
 * Demo runner: starts the service and agent together.
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... MERCHANT_ADDRESS=0x... node demo.js
 */

import { spawn } from 'node:child_process'

const required = ['AGENT_PRIVATE_KEY', 'MERCHANT_ADDRESS']
const missing = required.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')}`)
  console.error(`\nUsage:`)
  console.error(`  AGENT_PRIVATE_KEY=0x... MERCHANT_ADDRESS=0x... node demo.js`)
  process.exit(1)
}

const CHAIN = process.env.CHAIN || 'baseSepolia'
const PORT = process.env.SERVICE_PORT || '4000'

console.log(`\n  Starting AutoPay Agent Subscription Demo`)
console.log(`  Chain: ${CHAIN}\n`)

// Start the service
const service = spawn('node', ['service.js'], {
  stdio: 'inherit',
  env: { ...process.env, CHAIN, SERVICE_PORT: PORT },
})

// Clean up on Ctrl+C or unexpected exit
function cleanup() {
  service.kill()
  process.exit()
}
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
service.on('close', () => process.exit())

// Poll until the service is ready, then launch the agent
const SERVICE_URL = `http://localhost:${PORT}`

async function waitForService(maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${SERVICE_URL}/api/status`)
      if (res.ok) return
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  console.error('  Service failed to start')
  cleanup()
}

waitForService().then(() => {
  const agent = spawn('node', ['agent.js'], {
    stdio: 'inherit',
    env: { ...process.env, CHAIN, SERVICE_URL },
  })

  agent.on('close', (code) => {
    service.kill()
    process.exit(code)
  })
})
