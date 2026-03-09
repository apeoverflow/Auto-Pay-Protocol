/**
 * Generates .mcp.json for Claude Code and prints instructions.
 * Run: node --env-file=.env setup.js
 */

import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY
const CHAIN = process.env.CHAIN || 'flowEvm'

if (!PRIVATE_KEY || PRIVATE_KEY === '0x...') {
  console.error('Set AGENT_PRIVATE_KEY in .env first')
  process.exit(1)
}

const mcpDistPath = resolve(import.meta.dirname, '../../packages/mcp/dist/index.js')

const config = {
  mcpServers: {
    autopay: {
      command: 'node',
      args: [mcpDistPath],
      env: {
        AUTOPAY_PRIVATE_KEY: PRIVATE_KEY,
        AUTOPAY_CHAIN: CHAIN,
      },
    },
  },
}

// Write .mcp.json (gitignored — contains private key)
const mcpJsonPath = resolve(import.meta.dirname, '.mcp.json')
writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2) + '\n')

console.log()
console.log('  .mcp.json generated (gitignored)')
console.log()
console.log('  Now run the demo:')
console.log()
console.log('    1. Start the service:    npm run service')
console.log('    2. Open Claude Code:     claude')
console.log('    3. Ask:                  "Get me crypto prices from http://localhost:4000/api/prices"')
console.log()
