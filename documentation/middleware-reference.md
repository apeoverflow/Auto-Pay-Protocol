# Middleware Reference

Complete reference for `@autopayprotocol/middleware` — Express middleware that gates API endpoints behind active AutoPay subscriptions. Returns HTTP 402 with machine-readable discovery to unauthenticated agents, and verifies signed Bearer tokens against on-chain policies.

## Installation

```bash
npm install @autopayprotocol/middleware viem
```

Requires Node.js 20+ and `viem` ^2.0.0 as a peer dependency.

## Quick Example

```typescript
import express from 'express'
import { requireSubscription } from '@autopayprotocol/middleware'

const app = express()

const auth = requireSubscription({
  merchant: '0xYourMerchantAddress',
  chain: 'base',
  plans: [
    { name: 'Pro', amount: '10', interval: 2592000, description: 'Full API access' },
  ],
  relayerUrl: 'https://relayer.autopayprotocol.com',
})

// Protected endpoint
app.get('/api/data', auth, (req, res) => {
  res.json({
    subscriber: req.subscriber,  // payer address
    policyId: req.policyId,      // policy ID
    data: { /* your response */ },
  })
})

// Public endpoint (no middleware)
app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.listen(3000)
```

The middleware resolves the PolicyManager address, USDC address, RPC URL, and chain ID from the `chain` key — no need to look up contract addresses.

## Verification Flow

When a request hits a protected endpoint:

1. **Extract token**: Reads `Authorization: Bearer {token}` header
2. **No token?** Returns HTTP 402 with discovery body
3. **Parse token**: Splits `{policyId}.{expiry}.{signature}` — rejects invalid format
4. **Check expiry**: Rejects expired tokens (with clock skew tolerance)
5. **Check lifetime**: Rejects tokens with expiry too far in the future
6. **Recover signer**: Uses EIP-191 to recover the signing address from the signature
7. **Cache check**: If policy was recently verified and cached, validates signer match and returns
8. **On-chain read**: Reads policy from PolicyManager contract
9. **Validate**: Checks policy is active, merchant matches, and signer == payer
10. **Cache result**: Stores policy in LRU cache for subsequent requests
11. **Set request properties**: `req.subscriber` = payer address, `req.policyId` = policy ID

## API

### requireSubscription(options)

Express middleware factory. Returns middleware with an additional `invalidateCache` method.

```typescript
const auth = requireSubscription(options)

// Use as middleware
app.get('/api/data', auth, handler)

// Manually invalidate cache (e.g. after a webhook about policy cancellation)
auth.invalidateCache('0xPolicyId')  // specific policy
auth.invalidateCache()               // clear all
```

**Options (MiddlewareOptions):**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `merchant` | `0x${string}` | Yes | — | Your merchant address. Policies for other merchants are rejected. |
| `chain` | `ChainKey` | Yes | — | Chain: `'base'`, `'flowEvm'`, or `'baseSepolia'` |
| `plans` | `DiscoveryPlan[]` | Yes | — | Available subscription plans (included in 402 discovery) |
| `relayerUrl` | `string` | No | — | Relayer URL for agents to query existing subscriptions |
| `rpcUrl` | `string` | No | Chain default | Override the default RPC URL |
| `cacheTtlMs` | `number` | No | `60000` | How long to cache verified policies (ms) |
| `maxTokenAgeSeconds` | `number` | No | `86400` | Max allowed token lifetime in seconds |
| `clockSkewSeconds` | `number` | No | `30` | Clock skew tolerance in seconds |

### createSubscriptionVerifier(options)

Lower-level function for non-Express use cases (Fastify, Hono, plain Node.js, etc.). Use the exported `chains` object to look up chain config.

```typescript
import { createSubscriptionVerifier, chains } from '@autopayprotocol/middleware'

const chain = chains.base
const { verifySubscription, invalidateCache } = createSubscriptionVerifier({
  merchant: '0xYourAddress',
  policyManager: chain.policyManager,
  rpcUrl: chain.rpcUrl,
})

// In your custom middleware/handler:
const result = await verifySubscription(bearerToken)

if (result.ok) {
  // result.policy contains the full PolicyData
  console.log('Subscriber:', result.policy.payer)
  console.log('Charge amount:', result.policy.chargeAmount)
} else {
  // result.reason explains why verification failed
  console.log('Rejected:', result.reason)
}
```

**VerifyResult:**

```typescript
type VerifyResult =
  | { ok: true; policy: PolicyData }
  | { ok: false; reason: string }
```

**Possible rejection reasons:**
- `"Invalid token format. Expected: {policyId}.{expiry}.{signature}"`
- `"Token expired"`
- `"Token lifetime exceeds maximum allowed (86400s)"`
- `"Invalid signature"`
- `"Failed to read policy on-chain"`
- `"Subscription expired or cancelled"`
- `"Policy is for a different merchant"`
- `"Signer does not match policy payer"`

### createDiscoveryBody(options)

Builds the HTTP 402 response body that agents parse for subscription discovery.

```typescript
import { createDiscoveryBody, chains } from '@autopayprotocol/middleware'

const chain = chains.base
const body = createDiscoveryBody({
  merchant: '0xYourAddress',
  plans: [
    { name: 'Basic', amount: '5', interval: 2592000 },
    { name: 'Pro', amount: '10', interval: 2592000, description: 'Full API access' },
  ],
  networks: [
    { chainId: chain.chainId, name: chain.name, policyManager: chain.policyManager, usdc: chain.usdc },
  ],
  relayerUrl: 'https://relayer.autopayprotocol.com',
})
```

**DiscoveryPlan:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Plan name (e.g. `"Pro"`) |
| `amount` | `string` | Yes | USDC amount per cycle (e.g. `"10"`) |
| `interval` | `number` | Yes | Billing interval in seconds |
| `currency` | `string` | No | Currency identifier. Default: `"USDC"` |
| `description` | `string` | No | Human-readable plan description |
| `metadataUrl` | `string` | No | IPFS or HTTP URL for extended plan metadata |

## 402 Response Body

The discovery body returned on HTTP 402:

```json
{
  "error": "Subscription required",
  "accepts": ["autopay"],
  "autopay": {
    "type": "subscription",
    "merchant": "0xYourAddress",
    "plans": [
      {
        "name": "Pro",
        "amount": "10",
        "currency": "USDC",
        "interval": 2592000,
        "description": "Full API access",
        "metadataUrl": "ipfs://..."
      }
    ],
    "networks": [
      {
        "chainId": 8453,
        "name": "Base",
        "policyManager": "0x037A24595E96B10d9FB2c7c2668FE5e7F354c86a",
        "usdc": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
      }
    ],
    "relayerUrl": "https://relayer.autopayprotocol.com"
  }
}
```

When verification fails (invalid/expired token), the response includes an `error` field at the top level explaining the reason alongside the discovery body.

## PolicyData

The on-chain policy data returned in `VerifyResult` on success:

| Field | Type | Description |
|-------|------|-------------|
| `payer` | `0x${string}` | Subscriber wallet address |
| `merchant` | `0x${string}` | Merchant address |
| `chargeAmount` | `bigint` | Amount per charge (6-decimal raw) |
| `spendingCap` | `bigint` | Max total spend |
| `totalSpent` | `bigint` | Amount spent so far |
| `interval` | `number` | Billing interval in seconds |
| `lastCharged` | `number` | Unix timestamp of last charge |
| `chargeCount` | `number` | Total successful charges |
| `consecutiveFailures` | `number` | Failed charges in a row |
| `endTime` | `number` | When policy ended (0 if active) |
| `active` | `boolean` | Whether policy is active |
| `metadataUrl` | `string` | Plan metadata URL |

## Caching

The verifier uses an in-memory LRU cache to reduce on-chain reads:

- **Max entries**: 1000 (evicts all on overflow)
- **Default TTL**: 60 seconds (`cacheTtlMs`)
- Cache stores verified `PolicyData` with a timestamp
- On cache hit: only verifies signer matches (no RPC call)
- On cache miss or expired: reads from contract, then caches

For high-traffic services, tune `cacheTtlMs` to balance freshness vs. RPC costs. A 60s TTL means a cancelled policy may be accepted for up to 60s after cancellation.

## Bearer Token Format

```
{policyId}.{expiry}.{signature}
```

- **policyId**: `0x` + 64 hex chars (bytes32)
- **expiry**: Unix timestamp in seconds (when the token expires)
- **signature**: EIP-191 signature of `{policyId}:{expiry}`

The agent signs `{policyId}:{expiry}` with its wallet private key. The middleware recovers the signer and matches it to the on-chain policy payer.

## Request Properties

On successful verification, the middleware sets:

| Property | Type | Description |
|----------|------|-------------|
| `req.subscriber` | `string` | Payer wallet address (from on-chain policy) |
| `req.policyId` | `string` | Policy ID (from the Bearer token) |

These are available in subsequent middleware and route handlers.

## Supported Chains

| Chain | Key | Chain ID | PolicyManager | USDC |
|-------|-----|----------|---------------|------|
| Base | `'base'` | 8453 | `0x037A24595E96B10d9FB2c7c2668FE5e7F354c86a` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Flow EVM | `'flowEvm'` | 747 | `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345` | `0xF1815bd50389c46847f0Bda824eC8da914045D14` |
| Base Sepolia | `'baseSepolia'` | 84532 | `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

## Security Considerations

- **Non-custodial**: The middleware never holds funds. It only reads on-chain state to verify subscriptions.
- **Signature verification**: EIP-191 signature recovery ensures only the policy payer can create valid tokens.
- **Token lifetime limits**: `maxTokenAgeSeconds` (default 24h) prevents agents from creating indefinitely valid tokens.
- **Clock skew tolerance**: `clockSkewSeconds` (default 30s) prevents false rejections from minor clock differences.
- **Cache invalidation**: Use `invalidateCache()` when you receive a webhook about policy cancellation for immediate effect.
- **Rate limiting**: The middleware does not include rate limiting. Add your own rate limiter (e.g. `express-rate-limit`) for production use.
