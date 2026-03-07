# Agent SDK Reference

Complete API reference for `@autopayprotocol/agent-sdk` — the TypeScript SDK that lets autonomous AI agents manage USDC subscriptions on AutoPay Protocol.

## Installation

```bash
npm install @autopayprotocol/agent-sdk viem
```

Requires Node.js 20+ and `viem` ^2.0.0 as a peer dependency.

## AutoPayAgent

The core class. Wraps a wallet and provides methods to subscribe, cancel, query policies, and manage USDC.

### Constructor

```typescript
import { AutoPayAgent } from '@autopayprotocol/agent-sdk'

const agent = new AutoPayAgent({
  privateKey: '0x...',       // Required — agent wallet private key
  chain: 'base',             // Optional — 'base' | 'flowEvm' | 'baseSepolia'. Default: 'base'
  rpcUrl: '...',             // Optional — override the default public RPC
  policyManager: '0x...',    // Optional — override PolicyManager contract address
  usdc: '0x...',             // Optional — override USDC contract address
})
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `address` | `0x${string}` | Agent wallet address (derived from private key) |
| `chain` | `AgentChainConfig` | Resolved chain configuration |

### Methods

#### `subscribe(params: SubscribeParams): Promise<Subscription>`

Creates an on-chain subscription policy. Auto-approves USDC if current allowance is insufficient. The first charge executes immediately within the `createPolicy` transaction.

```typescript
const sub = await agent.subscribe({
  merchant: '0xMerchantAddress',
  amount: 10,              // 10 USDC per cycle
  interval: 'monthly',     // or seconds: 2592000
  spendingCap: 120,        // max 120 USDC total (optional, default: amount * 30)
  metadataUrl: 'ipfs://...' // optional
})

console.log(sub.policyId) // bytes32 hex
console.log(sub.txHash)   // transaction hash
```

**SubscribeParams:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `merchant` | `0x${string}` | Yes | Merchant EVM address |
| `amount` | `number` | Yes | USDC per billing cycle (human-readable, e.g. `10` = 10 USDC) |
| `interval` | `number \| IntervalPreset` | Yes | Billing interval in seconds or a preset name |
| `spendingCap` | `number` | No | Max total USDC spend. `0` = unlimited. Default: `amount * 30` |
| `metadataUrl` | `string` | No | Plan metadata URL (e.g. IPFS CID) |

**IntervalPreset values:** `'hourly'` (3600s) · `'daily'` (86400s) · `'weekly'` (604800s) · `'biweekly'` (1209600s) · `'monthly'` (2592000s) · `'quarterly'` (7776000s) · `'yearly'` (31536000s)

**Throws:** `InsufficientBalanceError`, `InsufficientGasError`, `TransactionFailedError`

#### `unsubscribe(policyId): Promise<0x${string}>`

Cancels a subscription by calling `revokePolicy` on-chain. Takes effect immediately — future charges will fail.

```typescript
const txHash = await agent.unsubscribe('0xPolicyId...')
```

#### `getPolicy(policyId): Promise<Policy>`

Reads the full on-chain policy struct from the PolicyManager contract.

```typescript
const policy = await agent.getPolicy('0xPolicyId...')
```

**Policy fields:**

| Field | Type | Description |
|-------|------|-------------|
| `policyId` | `0x${string}` | Policy identifier |
| `payer` | `0x${string}` | Subscriber wallet address |
| `merchant` | `0x${string}` | Merchant address |
| `chargeAmount` | `bigint` | Amount per charge (6-decimal raw) |
| `spendingCap` | `bigint` | Max total spend (6-decimal raw) |
| `totalSpent` | `bigint` | Amount spent so far |
| `interval` | `number` | Billing interval in seconds |
| `lastCharged` | `number` | Unix timestamp of last charge |
| `chargeCount` | `number` | Total successful charges |
| `consecutiveFailures` | `number` | Failed charges in a row (max 3 → auto-cancel) |
| `endTime` | `number` | Unix timestamp when policy ended (0 if active) |
| `active` | `boolean` | Whether the policy is active |
| `metadataUrl` | `string` | Plan metadata URL |

**Throws:** `PolicyNotFoundError` if the policy doesn't exist.

#### `isActive(policyId): Promise<boolean>`

Returns whether a policy is currently active.

#### `canCharge(policyId): Promise<{ ok: boolean; reason: string }>`

Checks if a policy can be charged right now. Returns the contract's `canCharge` result.

#### `getBalance(): Promise<bigint>`

Returns the agent's USDC balance as a raw 6-decimal bigint. Divide by `10^6` for human-readable.

#### `getGasBalance(): Promise<bigint>`

Returns the agent's native token balance (for gas) as a raw 18-decimal bigint.

#### `approveUsdc(amount?): Promise<0x${string}>`

Approves USDC spending to the PolicyManager. Called automatically by `subscribe()` when needed.

- `amount`: Optional bigint. Default: `MaxUint256` (unlimited).
- Returns: Transaction hash.

#### `createBearerToken(policyId, ttlSeconds?): Promise<string>`

Creates a signed Bearer token for authenticating with services.

- `policyId`: The on-chain policy ID.
- `ttlSeconds`: Token validity in seconds. Default: `3600` (1 hour).
- Returns: Token string in format `{policyId}.{expiry}.{signature}`.

The signature proves the agent owns the wallet that created the policy. Services verify by recovering the signer via EIP-191 and matching against the on-chain payer.

#### `bridgeUsdc(params: BridgeParams): Promise<BridgeResult>`

Bridges USDC from another chain to the agent's configured chain via LiFi.

```typescript
const result = await agent.bridgeUsdc({
  fromChainId: 1,           // Ethereum
  amount: 50,               // 50 USDC
  sourceRpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/...',
  slippage: 0.5,            // 0.5% (optional)
  onStatus: (s) => console.log(s.step), // optional callback
})
```

**BridgeParams:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fromChainId` | `number` | Yes | Source chain ID |
| `amount` | `number` | Yes | USDC amount (human-readable) |
| `sourceRpcUrl` | `string` | Yes | RPC URL for the source chain |
| `slippage` | `number` | No | Slippage in %. Default: `0.5` |
| `pollIntervalMs` | `number` | No | Status poll interval. Default: `10000` |
| `timeoutMs` | `number` | No | Bridge timeout. Default: `1800000` (30 min) |
| `onStatus` | `(status: BridgeStatus) => void` | No | Status callback |

**BridgeResult:**

| Field | Type | Description |
|-------|------|-------------|
| `sourceTxHash` | `0x${string}` | Transaction hash on source chain |
| `destinationTxHash` | `string?` | Transaction hash on destination chain |
| `fromChainId` | `number` | Source chain ID |
| `toChainId` | `number` | Destination chain ID |
| `fromAmount` | `string` | Formatted USDC sent |
| `toAmount` | `string` | Formatted USDC received |
| `durationMs` | `number` | Total bridge time |

**Supported source chains:** Ethereum (1), Optimism (10), Polygon (137), Arbitrum (42161), Avalanche (43114), BSC (56), Base (8453), Flow EVM (747), Base Sepolia (84532).

#### `swapNativeToUsdc(params: SwapParams): Promise<SwapResult>`

Swaps native tokens (FLOW, ETH, etc.) to USDC on the same chain via LiFi.

```typescript
const result = await agent.swapNativeToUsdc({
  amount: 1, // 1 FLOW/ETH
})
```

**SwapParams:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | `number` | Yes | Native token amount (e.g. `1` = 1 FLOW) |
| `slippage` | `number` | No | Slippage in %. Default: `0.5` |
| `pollIntervalMs` | `number` | No | Status poll interval. Default: `10000` |
| `timeoutMs` | `number` | No | Swap timeout. Default: `1800000` |
| `onStatus` | `(status: BridgeStatus) => void` | No | Status callback |

**SwapResult:**

| Field | Type | Description |
|-------|------|-------------|
| `txHash` | `0x${string}` | Transaction hash |
| `nativeAmount` | `string` | Formatted native token input |
| `usdcAmount` | `string` | Formatted USDC output |
| `durationMs` | `number` | Total swap time |

## wrapFetchWithSubscription

Wraps `fetch` to transparently handle HTTP 402 responses. When a request returns 402 with an AutoPay discovery body, the wrapper subscribes using the agent SDK and retries with a signed Bearer token.

```typescript
import { AutoPayAgent, wrapFetchWithSubscription, FileStore } from '@autopayprotocol/agent-sdk'

const agent = new AutoPayAgent({ privateKey: '0x...', chain: 'base' })

const fetchWithPay = wrapFetchWithSubscription(fetch, agent, {
  store: new FileStore('.autopay/subscriptions.json'),
  selectPlan: (plans) => plans.findIndex(p => p.name === 'Pro') ?? 0,
  spendingCap: (amount) => amount * 12,
  onSubscribe: (merchant, sub) => {
    console.log(`Subscribed to ${merchant}: ${sub.policyId}`)
  },
  bridge: {
    fromChainId: 1,
    sourceRpcUrl: 'https://eth.rpc.url',
    extraAmount: 5,
  },
})

const res = await fetchWithPay('https://api.paid-service.com/data')
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `store` | `SubscriptionStore` | `MemoryStore` | Persistence for merchant → policyId mapping |
| `selectPlan` | `(plans) => number` | `() => 0` | Returns index of plan to subscribe to |
| `spendingCap` | `(amount) => number` | `(a) => a * 30` | Compute spending cap from plan amount |
| `onSubscribe` | `(merchant, sub) => void` | — | Called after new subscription created |
| `onReuse` | `(merchant, policyId) => void` | — | Called when cached subscription is reused |
| `bridge` | `BridgeConfig` | — | Auto-bridge when balance insufficient |

### Bridge Config

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fromChainId` | `number` | Yes | Source chain to bridge from |
| `sourceRpcUrl` | `string` | Yes | RPC URL for the source chain |
| `extraAmount` | `number` | No | Extra USDC to bridge beyond subscription cost |
| `slippage` | `number` | No | Slippage tolerance in % |
| `onBridge` | `(status) => void` | No | Bridge status callback |

### Behavior

1. If the request already has an `Authorization` header, passes through unchanged.
2. Makes the request. If response is not 402, returns it.
3. Parses the 402 body for an `autopay` discovery block.
4. Checks local store for a cached subscription → retries with Bearer token.
5. If no cached sub, queries the relayer (if `relayerUrl` in discovery) for existing policies.
6. If still no sub, subscribes using the selected plan.
7. Auto-bridges USDC if `bridge` config is set and balance is insufficient.
8. Caches the subscription and signed Bearer token for future requests.

Token caching: Signed tokens are cached and reused until 5 minutes before expiry, then automatically refreshed.

## Subscription Stores

### SubscriptionStore Interface

```typescript
interface SubscriptionStore {
  get(merchant: string): Promise<StoreEntry | null>
  set(merchant: string, entry: StoreEntry): Promise<void>
  delete(merchant: string): Promise<void>
  all(): Promise<Map<string, StoreEntry>>
}

interface StoreEntry {
  policyId: `0x${string}`
  token?: string        // Cached signed Bearer token
  tokenExpiry?: number  // Token expiry as unix timestamp
}
```

### MemoryStore

Default store. Subscriptions lost on process restart.

```typescript
import { MemoryStore } from '@autopayprotocol/agent-sdk'
const store = new MemoryStore()
```

### FileStore

Persists subscriptions as JSON on disk. Automatically creates directories.

```typescript
import { FileStore } from '@autopayprotocol/agent-sdk'
const store = new FileStore('.autopay/subscriptions.json')
```

The file stores merchant → `StoreEntry` mappings. Compatible with legacy format (plain policyId strings).

## Error Classes

All errors extend `AgentError`, which has a `code` string property.

| Class | Code | Extra Properties |
|-------|------|-----------------|
| `InsufficientBalanceError` | `INSUFFICIENT_BALANCE` | `required: bigint`, `available: bigint` |
| `InsufficientGasError` | `INSUFFICIENT_GAS` | — |
| `InsufficientAllowanceError` | `INSUFFICIENT_ALLOWANCE` | — |
| `PolicyNotFoundError` | `POLICY_NOT_FOUND` | — |
| `PolicyNotActiveError` | `POLICY_NOT_ACTIVE` | — |
| `TransactionFailedError` | `TRANSACTION_FAILED` | `txHash?: string` |
| `BridgeQuoteError` | `BRIDGE_QUOTE_FAILED` | — |
| `BridgeExecutionError` | `BRIDGE_EXECUTION_FAILED` | `sourceTxHash?: 0x${string}` |
| `BridgeTimeoutError` | `BRIDGE_TIMEOUT` | `sourceTxHash: 0x${string}` |

```typescript
import { InsufficientBalanceError } from '@autopayprotocol/agent-sdk'

try {
  await agent.subscribe({ ... })
} catch (err) {
  if (err instanceof InsufficientBalanceError) {
    console.log(`Need ${err.required}, have ${err.available}`)
  }
}
```

## BridgeStatus

Status callback type used by both `bridgeUsdc` and `swapNativeToUsdc`:

```typescript
type BridgeStatus =
  | { step: 'quoting' }
  | { step: 'approving'; token: string }
  | { step: 'bridging'; txHash: `0x${string}` }
  | { step: 'waiting'; txHash: `0x${string}` }
  | { step: 'complete'; result: BridgeResult }
  | { step: 'failed'; error: string }
```

## Chain Configuration

The SDK ships with built-in chain configs (auto-generated from `chains.json`):

| Chain | Key | Chain ID | PolicyManager | USDC |
|-------|-----|----------|---------------|------|
| Base | `base` | 8453 | `0x037A24595E96B10d9FB2c7c2668FE5e7F354c86a` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Flow EVM | `flowEvm` | 747 | `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345` | `0xF1815bd50389c46847f0Bda824eC8da914045D14` |
| Base Sepolia | `baseSepolia` | 84532 | `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

All configs can be overridden via the `AgentConfig` constructor options (`rpcUrl`, `policyManager`, `usdc`).

### SOURCE_USDC

Known USDC contract addresses on source chains (for bridging):

| Chain | Chain ID | USDC Address |
|-------|----------|-------------|
| Ethereum | 1 | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Optimism | 10 | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` |
| Polygon | 137 | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |
| Arbitrum | 42161 | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| Avalanche | 43114 | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` |
| BSC | 56 | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` |
| Base | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Flow EVM | 747 | `0xF1815bd50389c46847f0Bda824eC8da914045D14` |
| Base Sepolia | 84532 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
