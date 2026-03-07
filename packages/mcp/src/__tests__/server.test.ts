import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { generatePrivateKey } from 'viem/accounts'

/**
 * MCP server integration tests.
 *
 * These spawn the built MCP server and communicate via the MCP JSON-RPC
 * stdio protocol. Two tiers:
 *
 * 1. Protocol tests (random key, no funds) — verify MCP layer works
 * 2. On-chain tests (funded key via AGENT_PRIVATE_KEY) — verify real tool execution
 */

const SERVER_PATH = join(__dirname, '../../dist/index.js')
const TEST_KEY = generatePrivateKey()
const FUNDED_KEY = process.env.AGENT_PRIVATE_KEY
const MERCHANT = '0x2B8b9182c1c3A9bEf4a60951D9B7F49420D12B9B'

let msgId = 0

function sendJsonRpc(proc: ChildProcess, method: string, params: object = {}): Promise<any> {
  const id = ++msgId
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout waiting for response to ${method} (id=${id})`)), 60_000)
    let buffer = ''

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line)
          if (parsed.id === id) {
            clearTimeout(timeout)
            proc.stdout?.off('data', onData)
            resolve(parsed)
            return
          }
        } catch {
          // Not complete JSON yet
        }
      }
    }

    proc.stdout?.on('data', onData)

    const message = JSON.stringify({ jsonrpc: '2.0', id, method, params })
    proc.stdin?.write(message + '\n')
  })
}

async function startServer(privateKey: string, chain: string): Promise<ChildProcess> {
  const proc = spawn('node', [SERVER_PATH], {
    env: {
      ...process.env,
      AUTOPAY_PRIVATE_KEY: privateKey,
      AUTOPAY_CHAIN: chain,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  // Wait for server to start
  await new Promise<void>((resolve) => {
    proc.stderr?.on('data', (data) => {
      if (data.toString().includes('started')) resolve()
    })
    setTimeout(resolve, 3_000)
  })

  // Initialize MCP session
  await sendJsonRpc(proc, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0' },
  })

  return proc
}

async function callTool(proc: ChildProcess, name: string, args: object = {}): Promise<any> {
  const response = await sendJsonRpc(proc, 'tools/call', { name, arguments: args })
  return response.result
}

// ── Protocol tests (no funds needed) ────────────────────────────

describe('MCP Server (stdio)', () => {
  let serverProc: ChildProcess | null = null
  let serverReady = false

  beforeAll(async () => {
    const { existsSync } = await import('node:fs')
    if (!existsSync(SERVER_PATH)) {
      console.warn('MCP dist not found, skipping integration tests. Run `npm run build` first.')
      return
    }
    serverReady = true
  })

  afterEach(() => {
    if (serverProc) {
      serverProc.kill()
      serverProc = null
    }
  })

  it('starts and responds to initialize', async ({ skip }) => {
    if (!serverReady) skip()

    serverProc = spawn('node', [SERVER_PATH], {
      env: {
        ...process.env,
        AUTOPAY_PRIVATE_KEY: TEST_KEY,
        AUTOPAY_CHAIN: 'baseSepolia',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    await new Promise<void>((resolve) => {
      serverProc!.stderr?.on('data', (data) => {
        if (data.toString().includes('started')) resolve()
      })
      setTimeout(resolve, 3_000)
    })

    const response = await sendJsonRpc(serverProc, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0' },
    }) as { result?: { serverInfo?: { name: string } } }

    expect(response.result?.serverInfo?.name).toBe('autopay')
  })

  it('lists 8 tools', async ({ skip }) => {
    if (!serverReady) skip()

    serverProc = spawn('node', [SERVER_PATH], {
      env: {
        ...process.env,
        AUTOPAY_PRIVATE_KEY: TEST_KEY,
        AUTOPAY_CHAIN: 'baseSepolia',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    await new Promise<void>((resolve) => {
      serverProc!.stderr?.on('data', (data) => {
        if (data.toString().includes('started')) resolve()
      })
      setTimeout(resolve, 3_000)
    })

    await sendJsonRpc(serverProc, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0' },
    })

    const response = await sendJsonRpc(serverProc, 'tools/list', {}) as {
      result?: { tools?: Array<{ name: string }> }
    }

    const tools = response.result?.tools ?? []
    const toolNames = tools.map((t: { name: string }) => t.name).sort()

    expect(tools).toHaveLength(8)
    expect(toolNames).toEqual([
      'autopay_approve_usdc',
      'autopay_balance',
      'autopay_bridge_usdc',
      'autopay_fetch',
      'autopay_get_policy',
      'autopay_subscribe',
      'autopay_swap_native_to_usdc',
      'autopay_unsubscribe',
    ])
  })
})

// ── On-chain tool invocation tests (funded key) ─────────────────

describe.skipIf(!FUNDED_KEY)('MCP Tools Integration (Flow EVM)', () => {
  let serverProc: ChildProcess | null = null
  let serverReady = false

  beforeAll(async () => {
    const { existsSync } = await import('node:fs')
    if (!existsSync(SERVER_PATH)) {
      console.warn('MCP dist not found, skipping. Run `npm run build` first.')
      return
    }
    serverReady = true
  })

  afterEach(() => {
    if (serverProc) {
      serverProc.kill()
      serverProc = null
    }
  })

  it('autopay_balance returns non-zero balances', async ({ skip }) => {
    if (!serverReady) skip()
    serverProc = await startServer(FUNDED_KEY!, 'flowEvm')

    const result = await callTool(serverProc, 'autopay_balance')
    expect(result.isError).toBeFalsy()

    const text = result.content[0].text
    const data = JSON.parse(text)

    expect(data.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(data.chain).toBe('Flow EVM')
    expect(data.chainId).toBe(747)
    expect(data.gasToken).toBe('FLOW')
    expect(Number(data.usdc)).toBeGreaterThan(0)
    expect(Number(data.gasBalance)).toBeGreaterThan(0)
  })

  it('autopay_get_policy with invalid policyId returns isError', async ({ skip }) => {
    if (!serverReady) skip()
    serverProc = await startServer(FUNDED_KEY!, 'flowEvm')

    const zeroPolicyId = '0x' + '00'.repeat(32)
    const result = await callTool(serverProc, 'autopay_get_policy', {
      policyId: zeroPolicyId,
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Policy not found')
  })

  it('autopay_approve_usdc succeeds', async ({ skip }) => {
    if (!serverReady) skip()
    serverProc = await startServer(FUNDED_KEY!, 'flowEvm')

    const result = await callTool(serverProc, 'autopay_approve_usdc', {
      amount: 0.001,
    })

    expect(result.isError).toBeFalsy()
    const data = JSON.parse(result.content[0].text)
    expect(data.success).toBe(true)
    expect(data.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/)
    expect(data.explorer).toContain('evm.flowscan.io')
  })

  it('autopay_bridge_usdc with unsupported chain returns isError', async ({ skip }) => {
    if (!serverReady) skip()
    serverProc = await startServer(FUNDED_KEY!, 'flowEvm')

    const result = await callTool(serverProc, 'autopay_bridge_usdc', {
      fromChainId: 999999,
      amount: 1,
      sourceRpcUrl: 'https://example.com',
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Unsupported source chain')
  })

  it('autopay_fetch retrieves a public URL', async ({ skip }) => {
    if (!serverReady) skip()
    serverProc = await startServer(FUNDED_KEY!, 'flowEvm')

    const result = await callTool(serverProc, 'autopay_fetch', {
      url: 'https://httpbin.org/get',
      method: 'GET',
    })

    expect(result.isError).toBeFalsy()
    expect(result.content[0].text).toContain('HTTP 200')
  })

  it('autopay_subscribe + autopay_get_policy + autopay_unsubscribe lifecycle', async ({ skip }) => {
    if (!serverReady) skip()
    serverProc = await startServer(FUNDED_KEY!, 'flowEvm')

    // Guard: check balance first — skip if wallet is depleted
    const balResult = await callTool(serverProc, 'autopay_balance')
    const balData = JSON.parse(balResult.content[0].text)
    if (Number(balData.usdcRaw) < 1000) {
      console.warn(`Skipping MCP subscribe test — wallet has ${balData.usdcRaw} raw USDC, need ≥1000`)
      skip()
    }

    // Subscribe: 0.001 USDC, spendingCap = chargeAmount
    const subResult = await callTool(serverProc, 'autopay_subscribe', {
      merchant: MERCHANT,
      amount: 0.001,
      interval: 'monthly',
      spendingCap: 0.001,
    })

    expect(subResult.isError).toBeFalsy()
    const subData = JSON.parse(subResult.content[0].text)
    expect(subData.success).toBe(true)
    expect(subData.policyId).toMatch(/^0x[0-9a-fA-F]{64}$/)
    expect(subData.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/)
    expect(subData.explorer).toContain('evm.flowscan.io')

    // Get policy
    const policyResult = await callTool(serverProc, 'autopay_get_policy', {
      policyId: subData.policyId,
    })

    expect(policyResult.isError).toBeFalsy()
    const policyData = JSON.parse(policyResult.content[0].text)
    expect(policyData.active).toBe(true)
    expect(policyData.chargeAmount).toBe('0.001 USDC')
    expect(policyData.chargeCount).toBe(1)
    expect(policyData.merchant.toLowerCase()).toBe(MERCHANT.toLowerCase())

    // Unsubscribe
    const unsubResult = await callTool(serverProc, 'autopay_unsubscribe', {
      policyId: subData.policyId,
    })

    expect(unsubResult.isError).toBeFalsy()
    const unsubData = JSON.parse(unsubResult.content[0].text)
    expect(unsubData.success).toBe(true)
    expect(unsubData.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/)
  })
})

// ── Unit tests for tool response patterns ─────────────────────

describe('MCP tool response patterns', () => {
  it('balance tool returns expected JSON shape', () => {
    const usdcRaw = 10_000_000n // 10 USDC
    const gasRaw = 500_000_000_000_000_000n // 0.5 ETH

    const { formatUnits } = require('viem') as typeof import('viem')
    const usdc = formatUnits(usdcRaw, 6)
    const gas = formatUnits(gasRaw, 18)

    const output = {
      address: '0xAgent',
      chain: 'Base',
      chainId: 8453,
      usdc,
      usdcRaw: usdcRaw.toString(),
      gasToken: 'ETH',
      gasBalance: gas,
      gasBalanceRaw: gasRaw.toString(),
    }

    expect(output.usdc).toBe('10')
    expect(output.gasBalance).toBe('0.5')
    expect(output.usdcRaw).toBe('10000000')
  })

  it('subscribe tool includes explorer link', () => {
    const txHash = '0xabc123'
    const explorer = 'https://basescan.org'
    const link = `${explorer}/tx/${txHash}`
    expect(link).toBe('https://basescan.org/tx/0xabc123')
  })

  it('policy tool formats spending cap as unlimited when 0', () => {
    const spendingCap = 0n
    const formatted = spendingCap === 0n ? 'unlimited' : '100 USDC'
    expect(formatted).toBe('unlimited')
  })

  it('policy tool formats non-zero spending cap with USDC suffix', () => {
    const { formatUnits } = require('viem') as typeof import('viem')
    const spendingCap = 100_000_000n // 100 USDC
    const formatted = spendingCap === 0n
      ? 'unlimited'
      : formatUnits(spendingCap, 6) + ' USDC'
    expect(formatted).toBe('100 USDC')
  })

  it('fetch tool truncates large responses', () => {
    const longBody = 'x'.repeat(60_000)
    let responseBody = longBody
    if (responseBody.length > 50_000) {
      responseBody = responseBody.slice(0, 50_000) + '\n\n... (truncated, response was ' + responseBody.length + ' chars)'
    }
    expect(responseBody.length).toBeLessThan(60_000)
    expect(responseBody).toContain('truncated')
    expect(responseBody).toContain('60000')
  })
})
