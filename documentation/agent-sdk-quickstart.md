# Agent SDK Quickstart

Get an AI agent subscribing to services in under 5 minutes.

AutoPay provides three npm packages for agent developers:

| Package | Purpose |
|---------|---------|
| [`@autopayprotocol/agent-sdk`](https://www.npmjs.com/package/@autopayprotocol/agent-sdk) | Core SDK — subscribe, cancel, bridge USDC, sign tokens |
| [`@autopayprotocol/mcp`](https://www.npmjs.com/package/@autopayprotocol/mcp) | MCP server — 8 tools for Claude Code, Cursor, and any MCP client |
| [`@autopayprotocol/middleware`](https://www.npmjs.com/package/@autopayprotocol/middleware) | Express middleware — verify subscriptions and serve 402 discovery |

---

## Option 1: MCP Server (Zero Code)

Add AutoPay to any MCP-compatible AI agent (Claude Code, Cursor, etc.) with zero code:

```json
{
  "mcpServers": {
    "autopay": {
      "command": "npx",
      "args": ["@autopayprotocol/mcp"],
      "env": {
        "AUTOPAY_PRIVATE_KEY": "0xYOUR_AGENT_PRIVATE_KEY",
        "AUTOPAY_CHAIN": "base"
      }
    }
  }
}
```

The agent gets 8 tools:

| Tool | What it does |
|------|-------------|
| `autopay_balance` | Check USDC and gas balances |
| `autopay_subscribe` | Create a subscription (first charge immediate) |
| `autopay_unsubscribe` | Cancel a subscription |
| `autopay_get_policy` | Read on-chain policy details |
| `autopay_fetch` | Fetch a URL with transparent 402 handling |
| `autopay_approve_usdc` | Pre-approve USDC spending |
| `autopay_bridge_usdc` | Bridge USDC from another chain via LiFi |
| `autopay_swap_native_to_usdc` | Swap native tokens (ETH, FLOW) to USDC |

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTOPAY_PRIVATE_KEY` | Yes | — | Agent wallet private key (or `AGENT_PRIVATE_KEY`) |
| `AUTOPAY_CHAIN` | No | `base` | Chain: `base`, `flowEvm`, or `baseSepolia` |
| `AUTOPAY_RPC_URL` | No | Public RPC | Override the default RPC endpoint |

---

## Option 2: Wrapped Fetch (Recommended for Programmatic Agents)

Install the SDK:

```bash
npm install @autopayprotocol/agent-sdk viem
```

Wrap `fetch` once — 402 discovery, subscription creation, and retry are all automatic:

```typescript
import { AutoPayAgent, wrapFetchWithSubscription, FileStore } from '@autopayprotocol/agent-sdk'

const agent = new AutoPayAgent({
  privateKey: process.env.AGENT_KEY as `0x${string}`,
  chain: 'base',
})

// FileStore persists subscriptions across restarts
const fetchWithPay = wrapFetchWithSubscription(fetch, agent, {
  store: new FileStore('.autopay/subscriptions.json'),
})

// Just fetch — if the service returns 402, the wrapper subscribes and retries
const res = await fetchWithPay('https://api.service.com/data')
const data = await res.json()
```

### What happens under the hood

1. Agent calls `fetchWithPay(url)`
2. Service returns `402` with AutoPay discovery (merchant, plans, networks)
3. Wrapper checks local store for an existing subscription
4. If none found, queries the relayer for an existing policy
5. If still none, calls `agent.subscribe()` (first charge is immediate)
6. Retries the original request with a signed `Bearer` token
7. Subsequent requests reuse the cached subscription

### Auto-Bridge

If the agent has USDC on a different chain, enable auto-bridging:

```typescript
const fetchWithPay = wrapFetchWithSubscription(fetch, agent, {
  store: new FileStore('.autopay/subscriptions.json'),
  bridge: {
    fromChainId: 1, // Ethereum mainnet
    sourceRpcUrl: 'https://eth.llamarpc.com',
    extraAmount: 5, // Bridge 5 extra USDC as buffer
  },
})
```

---

## Option 3: Direct SDK (Full Control)

For agents that need explicit control over every step:

```typescript
import { AutoPayAgent } from '@autopayprotocol/agent-sdk'

const agent = new AutoPayAgent({
  privateKey: process.env.AGENT_KEY as `0x${string}`,
  chain: 'base',
})

// Check balances
const usdc = await agent.getBalance()     // USDC (6 decimals)
const gas = await agent.getGasBalance()   // Native token (18 decimals)

// Subscribe to a service
const sub = await agent.subscribe({
  merchant: '0xMerchantAddress',
  amount: 10,           // 10 USDC per cycle
  interval: 'monthly',  // or seconds: 2592000
  spendingCap: 120,     // max 120 USDC total (optional)
})

console.log(sub.policyId) // bytes32 on-chain policy ID
console.log(sub.txHash)   // transaction hash

// Create a signed Bearer token for API requests
const token = await agent.createBearerToken(sub.policyId)

// Use the service
const res = await fetch('https://api.service.com/data', {
  headers: { Authorization: `Bearer ${token}` },
})

// Read policy details
const policy = await agent.getPolicy(sub.policyId)
console.log(policy.active, policy.totalSpent, policy.chargeCount)

// Cancel when done
await agent.unsubscribe(sub.policyId)
```

### Interval Presets

| Preset | Seconds |
|--------|---------|
| `hourly` | 3,600 |
| `daily` | 86,400 |
| `weekly` | 604,800 |
| `biweekly` | 1,209,600 |
| `monthly` | 2,592,000 |
| `quarterly` | 7,776,000 |
| `yearly` | 31,536,000 |

Or pass any number of seconds directly.

### Cross-Chain Bridging

Bridge USDC from another chain:

```typescript
const result = await agent.bridgeUsdc({
  fromChainId: 1,          // Ethereum
  amount: 50,              // 50 USDC
  sourceRpcUrl: 'https://eth.llamarpc.com',
})
console.log(result.sourceTxHash, result.toAmount)
```

Swap native tokens to USDC on the same chain:

```typescript
const result = await agent.swapNativeToUsdc({ amount: 0.1 }) // 0.1 ETH/FLOW
console.log(result.usdcAmount)
```

### Error Handling

The SDK throws typed errors:

```typescript
import {
  InsufficientBalanceError,
  InsufficientGasError,
  PolicyNotFoundError,
  BridgeQuoteError,
} from '@autopayprotocol/agent-sdk'

try {
  await agent.subscribe({ ... })
} catch (err) {
  if (err instanceof InsufficientBalanceError) {
    console.log(`Need ${err.required}, have ${err.available}`)
    // Bridge more USDC
  }
  if (err instanceof InsufficientGasError) {
    console.log('Need native tokens for gas')
  }
}
```

---

## Service-Side: Protecting Your API

Use `@autopayprotocol/middleware` to require subscriptions:

```bash
npm install @autopayprotocol/middleware viem
```

```typescript
import express from 'express'
import { requireSubscription } from '@autopayprotocol/middleware'

const auth = requireSubscription({
  merchant: '0xYourAddress',
  chain: 'base',
  plans: [
    { name: 'Basic', amount: '10', interval: 2592000, description: '10 USDC/month' },
  ],
})

const app = express()

// Public endpoint
app.get('/api/status', (req, res) => res.json({ ok: true }))

// Protected endpoint — returns 402 with discovery if no valid subscription
app.get('/api/data', auth, (req, res) => {
  res.json({ data: '...', subscriber: req.subscriber })
})
```

### What the middleware does

1. Checks for a `Bearer` token in the `Authorization` header
2. Verifies the token signature (EIP-191) and expiry
3. Reads the on-chain policy (cached 60s) to confirm it's active and matches the merchant
4. If valid: sets `req.subscriber` and `req.policyId`, calls `next()`
5. If invalid or missing: returns `402` with the AutoPay discovery body

---

## Contract Addresses

| Chain | Chain ID | PolicyManager | USDC |
|-------|----------|---------------|------|
| Base | 8453 | `0x037A24595E96B10d9FB2c7c2668FE5e7F354c86a` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Flow EVM | 747 | `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345` | `0xF1815bd50389c46847f0Bda824eC8da914045D14` |
| Base Sepolia | 84532 | `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

---

## Examples

See the [`examples/agent-subscription/`](https://github.com/apeoverflow/Auto-Pay-Protocol/tree/main/examples/agent-subscription) directory for runnable examples:

- **`agent.js`** — Manual flow: discover 402, subscribe, use service, cancel
- **`agent-wrapped.js`** — Zero-boilerplate: `wrapFetchWithSubscription` handles everything
- **`service.js`** — Example protected service using `@autopayprotocol/middleware`
