# @autopayprotocol/middleware

Express middleware for protecting API endpoints with [AutoPay Protocol](https://autopayprotocol.com) subscriptions. Returns HTTP 402 with machine-readable discovery to unauthenticated agents, verifies signed Bearer tokens against on-chain policies.

## Install

```bash
npm install @autopayprotocol/middleware viem
```

## Quickstart

```typescript
import express from 'express'
import { requireSubscription } from '@autopayprotocol/middleware'

const app = express()

const auth = requireSubscription({
  merchant: '0xYourAddress',
  chain: 'base',
  plans: [
    { name: 'Pro', amount: '10', interval: 2592000 }, // 30 days
  ],
})

app.get('/api/data', auth, (req, res) => {
  res.json({ subscriber: req.subscriber, data: '...' })
})
```

That's it. The middleware resolves the PolicyManager address, USDC address, RPC URL, and chain ID from the `chain` key. No need to look up contract addresses.

## How It Works

1. Agent sends request without auth → middleware returns **HTTP 402** with discovery body
2. Agent reads the 402 body, finds plans/networks, creates an on-chain subscription
3. Agent creates a signed Bearer token: `{policyId}.{expiry}.{signature}`
4. Agent retries with `Authorization: Bearer {token}`
5. Middleware verifies: token format → expiry → signature recovery → on-chain policy check
6. On success, sets `req.subscriber` (payer address) and `req.policyId`

## API Reference

### `requireSubscription(options)`

Express middleware factory. Returns middleware that gates routes behind an active subscription.

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `merchant` | `0x${string}` | Yes | — | Your merchant address |
| `chain` | `ChainKey` | Yes | — | Chain: `'base'`, `'flowEvm'`, or `'baseSepolia'` |
| `plans` | `DiscoveryPlan[]` | Yes | — | Available subscription plans |
| `relayerUrl?` | `string` | No | — | Relayer URL for agents to query existing subscriptions |
| `rpcUrl?` | `string` | No | Chain default | Override the default RPC URL |
| `cacheTtlMs?` | `number` | No | `60000` | Policy cache TTL (ms) |
| `maxTokenAgeSeconds?` | `number` | No | `86400` | Max token lifetime (seconds) |
| `clockSkewSeconds?` | `number` | No | `30` | Clock skew tolerance (seconds) |

The returned middleware has an `invalidateCache(policyId?)` method for manual cache clearing.

### `createSubscriptionVerifier(options)`

Lower-level verifier for non-Express use cases. Returns `{ verifySubscription, invalidateCache }`.

```typescript
import { createSubscriptionVerifier, chains } from '@autopayprotocol/middleware'

const chain = chains.base
const { verifySubscription } = createSubscriptionVerifier({
  merchant: '0x...',
  policyManager: chain.policyManager,
  rpcUrl: chain.rpcUrl,
})

const result = await verifySubscription(bearerToken)
if (result.ok) {
  console.log('Subscriber:', result.policy.payer)
}
```

### `createDiscoveryBody(options)`

Builds the 402 response body that agents parse for subscription discovery.

```typescript
import { createDiscoveryBody, chains } from '@autopayprotocol/middleware'

const chain = chains.base
const body = createDiscoveryBody({
  merchant: '0x...',
  plans: [{ name: 'Pro', amount: '10', interval: 2592000 }],
  networks: [{ chainId: chain.chainId, name: chain.name, policyManager: chain.policyManager, usdc: chain.usdc }],
})
```

### Discovery Body Shape

```json
{
  "error": "Subscription required",
  "accepts": ["autopay"],
  "autopay": {
    "type": "subscription",
    "merchant": "0x...",
    "plans": [
      { "name": "Pro", "amount": "10", "currency": "USDC", "interval": 2592000 }
    ],
    "networks": [
      { "chainId": 8453, "name": "Base", "policyManager": "0x...", "usdc": "0x..." }
    ],
    "relayerUrl": "https://relayer.autopayprotocol.com"
  }
}
```

### Request Properties (set on success)

| Property | Type | Description |
|----------|------|-------------|
| `req.subscriber` | `string` | Payer wallet address |
| `req.policyId` | `string` | Policy ID from the Bearer token |

## Supported Chains

| Chain | Key | Chain ID | PolicyManager |
|-------|-----|----------|---------------|
| Base | `'base'` | 8453 | `0x037A24595E96B10d9FB2c7c2668FE5e7F354c86a` |
| Flow EVM | `'flowEvm'` | 747 | `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345` |
| Base Sepolia | `'baseSepolia'` | 84532 | `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345` |

## Security

- **On-chain verification**: Every token is verified against the live PolicyManager contract
- **LRU cache**: Active policies cached (60s default, max 1000 entries) to reduce RPC calls
- **Token lifetime limits**: Tokens with expiry beyond `maxTokenAgeSeconds` are rejected
- **Clock skew tolerance**: Configurable buffer for clock differences between agent and server
- **Signature recovery**: EIP-191 signature verified — signer must match the on-chain policy payer

## Links

- [Full Documentation](https://autopayprotocol.com/docs)
- [Agent SDK](https://www.npmjs.com/package/@autopayprotocol/agent-sdk)
- [MCP Server](https://www.npmjs.com/package/@autopayprotocol/mcp)
