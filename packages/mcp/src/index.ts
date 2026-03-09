import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { formatUnits, parseUnits } from 'viem'
import {
  AutoPayAgent,
  wrapFetchWithSubscription,
  SOURCE_USDC,
  USDC_DECIMALS,
  type ChainKey,
} from '@autopayprotocol/agent-sdk'

// ── Helpers ──────────────────────────────────────────────────────

function formatInterval(interval: number | string): string {
  if (typeof interval === 'string') return interval
  if (interval <= 60) return `${interval}s`
  if (interval <= 3600) return `${Math.round(interval / 60)}min`
  if (interval <= 86400) return `${Math.round(interval / 3600)}hr`
  return `${Math.round(interval / 86400)}day`
}

// ── Config from env ─────────────────────────────────────────────

const PRIVATE_KEY = process.env.AUTOPAY_PRIVATE_KEY || process.env.AGENT_PRIVATE_KEY
const CHAIN = (process.env.AUTOPAY_CHAIN || process.env.CHAIN || 'base') as ChainKey
const RPC_URL = process.env.AUTOPAY_RPC_URL

if (!PRIVATE_KEY) {
  console.error(
    'AutoPay MCP: AUTOPAY_PRIVATE_KEY (or AGENT_PRIVATE_KEY) env var is required',
  )
  process.exit(1)
}

// ── Initialize agent ────────────────────────────────────────────

const agent = new AutoPayAgent({
  privateKey: PRIVATE_KEY as `0x${string}`,
  chain: CHAIN,
  rpcUrl: RPC_URL,
})

// Wrapped fetch — logs 402 discovery, subscription, and reuse events to stderr
// (visible in Claude Code's Ctrl+O log view)
const fetchWithPay = wrapFetchWithSubscription(fetch, agent, {
  onDiscovery: (url, discovery) => {
    console.error(`\n  ⚡ HTTP 402 Payment Required — ${url}`)
    console.error(`  ┌─────────────────────────────────────`)
    console.error(`  │ Merchant:  ${discovery.merchant}`)
    for (const plan of discovery.plans) {
      console.error(`  │ Plan:      ${plan.name} — ${plan.amount} ${plan.currency}/${formatInterval(plan.interval)}`)
      if (plan.description) console.error(`  │            ${plan.description}`)
    }
    for (const net of discovery.networks) {
      console.error(`  │ Network:   ${net.name} (${net.chainId})`)
    }
    console.error(`  └─────────────────────────────────────`)
  },
  onSubscribe: (merchant, sub) => {
    console.error(`\n  ✓ Subscribed on-chain`)
    console.error(`    Policy:   ${sub.policyId}`)
    console.error(`    Tx:       ${agent.chain.explorer}/tx/${sub.txHash}`)
    console.error(`    Merchant: ${merchant}`)
  },
  onReuse: (merchant, policyId) => {
    console.error(`\n  ↻ Reusing cached subscription for ${merchant}`)
    console.error(`    Policy:   ${policyId}`)
  },
})

// ── MCP Server ──────────────────────────────────────────────────

const server = new McpServer({
  name: 'autopay',
  version: '0.1.0',
})

// ── Tool: autopay_balance ───────────────────────────────────────

server.registerTool(
  'autopay_balance',
  {
    description: 'Check the agent wallet\'s USDC balance and native gas token balance on the configured chain',
  },
  async () => {
    try {
      const [usdcRaw, gasRaw] = await Promise.all([
        agent.getBalance(),
        agent.getGasBalance(),
      ])

      const usdc = formatUnits(usdcRaw, USDC_DECIMALS)
      const gas = formatUnits(gasRaw, 18)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            address: agent.address,
            chain: agent.chain.name,
            chainId: agent.chain.chainId,
            usdc,
            usdcRaw: usdcRaw.toString(),
            gasToken: agent.chain.nativeCurrency.symbol,
            gasBalance: gas,
            gasBalanceRaw: gasRaw.toString(),
          }, null, 2),
        }],
      }
    } catch (err) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Balance check failed: ${err instanceof Error ? err.message : String(err)}`,
        }],
      }
    }
  },
)

// ── Tool: autopay_subscribe ─────────────────────────────────────

server.registerTool(
  'autopay_subscribe',
  {
    description: 'Subscribe to a merchant service by creating an on-chain policy. Charges the first payment immediately. Auto-approves USDC if needed.',
    inputSchema: {
      merchant: z.string().describe('Merchant EVM address (0x...)'),
      amount: z.number().positive().describe('USDC amount per billing cycle (e.g. 10 for 10 USDC)'),
      interval: z.union([
        z.enum(['hourly', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
        z.number().int().positive(),
      ]).describe('Billing interval: a preset name or seconds'),
      spendingCap: z.number().nonnegative().optional().describe('Max total USDC spend. 0 = unlimited. Default: amount * 30'),
      metadataUrl: z.string().optional().describe('Optional metadata URL for the plan'),
    },
  },
  async ({ merchant, amount, interval, spendingCap, metadataUrl }) => {
    try {
      const sub = await agent.subscribe({
        merchant: merchant as `0x${string}`,
        amount,
        interval,
        spendingCap,
        metadataUrl,
      })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            policyId: sub.policyId,
            txHash: sub.txHash,
            explorer: `${agent.chain.explorer}/tx/${sub.txHash}`,
            merchant,
            amount,
            interval,
          }, null, 2),
        }],
      }
    } catch (err) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Subscribe failed: ${err instanceof Error ? err.message : String(err)}`,
        }],
      }
    }
  },
)

// ── Tool: autopay_unsubscribe ───────────────────────────────────

server.registerTool(
  'autopay_unsubscribe',
  {
    description: 'Cancel an active subscription by revoking the on-chain policy. Takes effect immediately.',
    inputSchema: {
      policyId: z.string().describe('The policy ID (bytes32 hex string) to cancel'),
    },
  },
  async ({ policyId }) => {
    try {
      const txHash = await agent.unsubscribe(policyId as `0x${string}`)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            policyId,
            txHash,
            explorer: `${agent.chain.explorer}/tx/${txHash}`,
          }, null, 2),
        }],
      }
    } catch (err) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Unsubscribe failed: ${err instanceof Error ? err.message : String(err)}`,
        }],
      }
    }
  },
)

// ── Tool: autopay_get_policy ────────────────────────────────────

server.registerTool(
  'autopay_get_policy',
  {
    description: 'Read the on-chain details of a subscription policy: status, charge amount, spending cap, total spent, etc.',
    inputSchema: {
      policyId: z.string().describe('The policy ID (bytes32 hex string) to look up'),
    },
  },
  async ({ policyId }) => {
    try {
      const policy = await agent.getPolicy(policyId as `0x${string}`)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            policyId: policy.policyId,
            active: policy.active,
            payer: policy.payer,
            merchant: policy.merchant,
            chargeAmount: formatUnits(policy.chargeAmount, USDC_DECIMALS) + ' USDC',
            spendingCap: policy.spendingCap === 0n
              ? 'unlimited'
              : formatUnits(policy.spendingCap, USDC_DECIMALS) + ' USDC',
            totalSpent: formatUnits(policy.totalSpent, USDC_DECIMALS) + ' USDC',
            interval: policy.interval + 's',
            chargeCount: policy.chargeCount,
            consecutiveFailures: policy.consecutiveFailures,
            metadataUrl: policy.metadataUrl || null,
          }, null, 2),
        }],
      }
    } catch (err) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Get policy failed: ${err instanceof Error ? err.message : String(err)}`,
        }],
      }
    }
  },
)

// ── Tool: autopay_fetch ─────────────────────────────────────────

server.registerTool(
  'autopay_fetch',
  {
    description: 'Fetch a URL. If the server returns HTTP 402 with AutoPay subscription requirements, automatically subscribes and retries. Cached subscriptions are reused across calls.',
    inputSchema: {
      url: z.string().url().describe('The URL to fetch'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional().describe('HTTP method. Default: GET'),
      headers: z.record(z.string()).optional().describe('Request headers as key-value pairs'),
      body: z.string().optional().describe('Request body (for POST/PUT/PATCH)'),
    },
  },
  async ({ url, method, headers, body }) => {
    try {
      const init: RequestInit = {}
      if (method) init.method = method
      if (headers) init.headers = headers
      if (body) init.body = body

      const res = await fetchWithPay(url, init)
      const contentType = res.headers.get('content-type') || ''
      let responseBody: string

      if (contentType.includes('application/json')) {
        const json = await res.json()
        responseBody = JSON.stringify(json, null, 2)
      } else {
        responseBody = await res.text()
      }

      // Truncate very large responses
      if (responseBody.length > 50_000) {
        responseBody = responseBody.slice(0, 50_000) + '\n\n... (truncated, response was ' + responseBody.length + ' chars)'
      }

      return {
        content: [{
          type: 'text',
          text: `HTTP ${res.status} ${res.statusText}\n\n${responseBody}`,
        }],
      }
    } catch (err) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        }],
      }
    }
  },
)

// ── Tool: autopay_approve_usdc ──────────────────────────────────

server.registerTool(
  'autopay_approve_usdc',
  {
    description: 'Approve USDC spending to the PolicyManager contract. Usually not needed — autopay_subscribe auto-approves. Use this for explicit pre-approval.',
    inputSchema: {
      amount: z.number().positive().optional().describe('USDC amount to approve (e.g. 100 for 100 USDC). Default: unlimited (MaxUint256)'),
    },
  },
  async ({ amount }) => {
    try {
      const approvalAmount = amount != null ? parseUnits(String(amount), USDC_DECIMALS) : undefined
      const txHash = await agent.approveUsdc(approvalAmount)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            txHash,
            explorer: `${agent.chain.explorer}/tx/${txHash}`,
            amount: amount != null ? `${amount} USDC` : 'unlimited',
          }, null, 2),
        }],
      }
    } catch (err) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Approve failed: ${err instanceof Error ? err.message : String(err)}`,
        }],
      }
    }
  },
)

// ── Tool: autopay_bridge_usdc ────────────────────────────────────

server.registerTool(
  'autopay_bridge_usdc',
  {
    description: 'Bridge USDC from another chain to the agent\'s configured chain. Use this when the agent needs USDC on the destination chain but has funds on a different chain. Supported source chains: Ethereum (1), Optimism (10), Polygon (137), Arbitrum (42161), Avalanche (43114), BSC (56), Base (8453), Flow EVM (747).',
    inputSchema: {
      fromChainId: z.number().int().positive().describe('Source chain ID (1=Ethereum, 8453=Base, 137=Polygon, 42161=Arbitrum, 10=Optimism, 56=BSC, 43114=Avalanche)'),
      amount: z.number().positive().describe('USDC amount to bridge (e.g. 10 for 10 USDC)'),
      sourceRpcUrl: z.string().url().describe('RPC URL for the source chain'),
      slippage: z.number().optional().describe('Slippage tolerance in percent. Default: 0.5'),
    },
  },
  async ({ fromChainId, amount, sourceRpcUrl, slippage }) => {
    try {
      if (!SOURCE_USDC[fromChainId]) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Unsupported source chain ${fromChainId}. Supported: ${Object.keys(SOURCE_USDC).join(', ')}`,
          }],
        }
      }

      const result = await agent.bridgeUsdc({
        fromChainId,
        amount,
        sourceRpcUrl,
        slippage,
      })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            sourceTxHash: result.sourceTxHash,
            destinationTxHash: result.destinationTxHash ?? null,
            fromChainId: result.fromChainId,
            toChainId: result.toChainId,
            fromAmount: result.fromAmount + ' USDC',
            toAmount: result.toAmount + ' USDC',
            durationMs: result.durationMs,
          }, null, 2),
        }],
      }
    } catch (err) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Bridge failed: ${err instanceof Error ? err.message : String(err)}`,
        }],
      }
    }
  },
)

// ── Tool: autopay_swap_native_to_usdc ────────────────────────────

server.registerTool(
  'autopay_swap_native_to_usdc',
  {
    description: 'Swap native tokens (FLOW, ETH, etc.) to USDC on the agent\'s configured chain via LiFi. Use this when the agent has native tokens but needs USDC for subscriptions.',
    inputSchema: {
      amount: z.number().positive().describe('Native token amount to swap (e.g. 1 for 1 FLOW/ETH)'),
      slippage: z.number().optional().describe('Slippage tolerance in percent. Default: 0.5'),
    },
  },
  async ({ amount, slippage }) => {
    try {
      const result = await agent.swapNativeToUsdc({ amount, slippage })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            txHash: result.txHash,
            explorer: `${agent.chain.explorer}/tx/${result.txHash}`,
            nativeAmount: result.nativeAmount + ` ${agent.chain.nativeCurrency.symbol}`,
            usdcAmount: result.usdcAmount + ' USDC',
            durationMs: result.durationMs,
          }, null, 2),
        }],
      }
    } catch (err) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Swap failed: ${err instanceof Error ? err.message : String(err)}`,
        }],
      }
    }
  },
)

// ── Start ───────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`AutoPay MCP server started`)
  console.error(`  Wallet:  ${agent.address}`)
  console.error(`  Chain:   ${agent.chain.name} (${agent.chain.chainId})`)
}

main().catch((err) => {
  console.error('AutoPay MCP server failed to start:', err)
  process.exit(1)
})
