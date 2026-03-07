# @autopayprotocol/agent-sdk

TypeScript SDK for autonomous AI agents to manage USDC subscriptions on [AutoPay Protocol](https://autopayprotocol.com). Subscribe, cancel, bridge USDC cross-chain, and authenticate with services — all from code.

## Install

```bash
npm install @autopayprotocol/agent-sdk viem
```

## Quickstart

```typescript
import { AutoPayAgent, wrapFetchWithSubscription } from '@autopayprotocol/agent-sdk'

const agent = new AutoPayAgent({
  privateKey: '0x...',
  chain: 'base', // 'base' | 'flowEvm' | 'baseSepolia'
})

// Option 1: Wrapped fetch — auto-subscribes on HTTP 402
const fetchWithPay = wrapFetchWithSubscription(fetch, agent)
const res = await fetchWithPay('https://api.example.com/data')

// Option 2: Direct subscription
const sub = await agent.subscribe({
  merchant: '0x...',
  amount: 10,          // 10 USDC
  interval: 'monthly',
})

const token = await agent.createBearerToken(sub.policyId)
```

## API Reference

### `AutoPayAgent`

| Method | Description |
|--------|-------------|
| `subscribe(params)` | Create subscription. Auto-approves USDC. First charge is immediate. |
| `unsubscribe(policyId)` | Cancel subscription by revoking the on-chain policy. |
| `getPolicy(policyId)` | Read full on-chain policy details. |
| `isActive(policyId)` | Check if a policy is currently active. |
| `canCharge(policyId)` | Check if a policy can be charged right now. |
| `getBalance()` | Get USDC balance (raw 6-decimal bigint). |
| `getGasBalance()` | Get native token balance for gas. |
| `approveUsdc(amount?)` | Approve USDC to PolicyManager. Default: MaxUint256. |
| `createBearerToken(policyId, ttlSeconds?)` | Create signed auth token. Default TTL: 1 hour. |
| `bridgeUsdc(params)` | Bridge USDC from another chain via LiFi. |
| `swapNativeToUsdc(params)` | Swap native tokens to USDC on the same chain. |

### `SubscribeParams`

| Field | Type | Description |
|-------|------|-------------|
| `merchant` | `0x${string}` | Merchant address |
| `amount` | `number` | USDC amount per cycle (e.g. `10` = 10 USDC) |
| `interval` | `number \| IntervalPreset` | Billing interval in seconds or preset |
| `spendingCap?` | `number` | Max total USDC spend. Default: `amount * 30` |
| `metadataUrl?` | `string` | Optional metadata URL (e.g. IPFS CID) |

**IntervalPreset**: `'hourly'` | `'daily'` | `'weekly'` | `'biweekly'` | `'monthly'` | `'quarterly'` | `'yearly'`

### `wrapFetchWithSubscription(fetchFn, agent, options?)`

Wraps `fetch` to transparently handle HTTP 402 responses with AutoPay discovery. On first 402, subscribes and retries. Subsequent requests reuse cached subscriptions.

| Option | Type | Description |
|--------|------|-------------|
| `store?` | `SubscriptionStore` | Persistence backend. Default: `MemoryStore` |
| `selectPlan?` | `(plans) => number` | Plan selection strategy. Default: first plan (index 0) |
| `spendingCap?` | `(amount) => number` | Cap strategy. Default: `amount * 30` |
| `onSubscribe?` | `(merchant, sub) => void` | Called after new subscription |
| `onReuse?` | `(merchant, policyId) => void` | Called when cached subscription is reused |
| `bridge?` | `{ fromChainId, sourceRpcUrl, ... }` | Auto-bridge config for cross-chain funding |

### Stores

| Store | Description |
|-------|-------------|
| `MemoryStore` | In-memory (default). Lost on restart. |
| `FileStore(path)` | File-backed JSON. Persists across restarts. |

### Error Classes

| Error | Code | Description |
|-------|------|-------------|
| `InsufficientBalanceError` | `INSUFFICIENT_BALANCE` | Not enough USDC |
| `InsufficientGasError` | `INSUFFICIENT_GAS` | No native tokens for gas |
| `PolicyNotFoundError` | `POLICY_NOT_FOUND` | Policy doesn't exist |
| `PolicyNotActiveError` | `POLICY_NOT_ACTIVE` | Policy is cancelled/expired |
| `TransactionFailedError` | `TRANSACTION_FAILED` | On-chain transaction failed |
| `BridgeQuoteError` | `BRIDGE_QUOTE_FAILED` | LiFi quote failed |
| `BridgeExecutionError` | `BRIDGE_EXECUTION_FAILED` | Bridge tx failed |
| `BridgeTimeoutError` | `BRIDGE_TIMEOUT` | Bridge polling timed out |

## Supported Chains

| Chain | Key | Chain ID |
|-------|-----|----------|
| Base | `base` | 8453 |
| Flow EVM | `flowEvm` | 747 |
| Base Sepolia | `baseSepolia` | 84532 |

## Configuration

```typescript
const agent = new AutoPayAgent({
  privateKey: '0x...',       // Required
  chain: 'base',             // Default: 'base'
  rpcUrl: '...',             // Override default RPC
  policyManager: '0x...',    // Override contract address
  usdc: '0x...',             // Override USDC address
})
```

## Links

- [Full Documentation](https://autopayprotocol.com/docs)
- [Agent SDK Quickstart](https://github.com/apeoverflow/Auto-Pay-Protocol/blob/main/documentation/agent-sdk-quickstart.md)
- [MCP Server](https://www.npmjs.com/package/@autopayprotocol/mcp)
- [Middleware](https://www.npmjs.com/package/@autopayprotocol/middleware)
