# @autopayprotocol/sdk

Server-side helpers for merchants integrating with [AutoPay Protocol](https://autopayprotocol.com) — crypto subscriptions that are 50% cheaper than Stripe, fully non-custodial, and multi-chain.

This SDK handles what merchants need on their backend: building checkout URLs, verifying webhook signatures, and working with USDC amounts. It has **zero runtime dependencies** and works with any Node.js framework.

## Install

```bash
npm install @autopayprotocol/sdk
```

Requires Node.js 20+.

## Checkout URLs

The checkout URL is how you send users to subscribe. There are two ways to build one:

### From a relayer-hosted plan

If you manage plans through the [merchant dashboard](https://autopayprotocol.com), the SDK fetches billing params and metadata automatically:

```ts
import { createCheckoutUrlFromPlan } from '@autopayprotocol/sdk'

const url = await createCheckoutUrlFromPlan({
  relayerUrl: 'https://autopay-relayer-production.up.railway.app',
  merchant: '0x2B8b9182c1c3A9bEf4a60951D9B7F49420D12B9B',
  planId: 'pro-plan',
  successUrl: 'https://mysite.com/success',
  cancelUrl: 'https://mysite.com/cancel',
})
// Redirect the user to `url`
```

### Directly with billing params

If you host your own plan metadata JSON:

```ts
import { createCheckoutUrl } from '@autopayprotocol/sdk'

const url = createCheckoutUrl({
  merchant: '0x2B8b9182c1c3A9bEf4a60951D9B7F49420D12B9B',
  amount: 9.99,
  interval: 'monthly',
  metadataUrl: 'https://mysite.com/plans/pro.json',
  successUrl: 'https://mysite.com/success',
  cancelUrl: 'https://mysite.com/cancel',
  spendingCap: 119.88, // optional, 12 months worth
})
```

### Targeting a chain

AutoPay runs on multiple chains. Use the `chain` option to target a specific one:

```ts
import { createCheckoutUrl } from '@autopayprotocol/sdk'

// Base (default) — autopayprotocol.com
const baseUrl = createCheckoutUrl({ ... })

// Flow EVM — flow.autopayprotocol.com
const flowUrl = createCheckoutUrl({
  ...options,
  chain: 'flowEvm',
})

// Base Sepolia (testnet) — staging.autopayprotocol.com
const testUrl = createCheckoutUrl({
  ...options,
  chain: 'baseSepolia',
})
```

Available chains:

| Chain | ID | `chain` value | Checkout URL |
|-------|-----|--------------|-------------|
| Base | 8453 | `'base'` (default) | `https://autopayprotocol.com` |
| Flow EVM | 747 | `'flowEvm'` | `https://flow.autopayprotocol.com` |
| Base Sepolia | 84532 | `'baseSepolia'` | `https://staging.autopayprotocol.com` |

### Intervals

Use preset strings or build custom intervals:

```ts
import { createCheckoutUrl, intervals } from '@autopayprotocol/sdk'

// Preset strings: 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'
createCheckoutUrl({ ..., interval: 'monthly' })

// Custom: 14 days
createCheckoutUrl({ ..., interval: intervals.custom(14, 'days') })

// Raw seconds
createCheckoutUrl({ ..., interval: 604800 })
```

### Success redirect

After subscribing, users are redirected to your `successUrl` with query params:

```ts
import { parseSuccessRedirect } from '@autopayprotocol/sdk'

// On your success page:
const { policyId, txHash } = parseSuccessRedirect(window.location.search)
```

## Webhooks

The relayer sends webhook events to your server when subscriptions change. Each request includes an `x-autopay-signature` header (HMAC-SHA256).

### Next.js (App Router)

```ts
// app/api/autopay/route.ts
import { verifyWebhook } from '@autopayprotocol/sdk'

const SECRET = process.env.AUTOPAY_WEBHOOK_SECRET!

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-autopay-signature') ?? undefined

  try {
    const event = verifyWebhook(rawBody, signature, SECRET)

    if (event.type === 'charge.succeeded') {
      // TypeScript knows event.data has amount, protocolFee, txHash
      await recordPayment(event.data.payer, event.data.amount, event.data.txHash)
    }

    return Response.json({ received: true })
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }
}
```

### Express

```ts
import express from 'express'
import { verifyWebhook } from '@autopayprotocol/sdk'

const app = express()
const SECRET = process.env.AUTOPAY_WEBHOOK_SECRET!

// Important: use express.text() so the raw body is available for signature verification
app.post('/webhook/autopay', express.text({ type: '*/*' }), (req, res) => {
  try {
    const event = verifyWebhook(req.body, req.headers['x-autopay-signature'] as string, SECRET)

    switch (event.type) {
      case 'policy.created':    /* grant access */     break
      case 'charge.succeeded':  /* record payment */   break
      case 'charge.failed':     /* send reminder */    break
      case 'policy.revoked':    /* revoke access */    break
      case 'policy.cancelled_by_failure': /* revoke */ break
    }

    res.json({ received: true })
  } catch {
    res.status(401).json({ error: 'Invalid signature' })
  }
})
```

### Event types

All events include `policyId`, `chainId`, `payer`, and `merchant` in `event.data`.

| Event | Extra fields | When |
|-------|-------------|------|
| `policy.created` | `chargeAmount`, `interval`, `spendingCap`, `metadataUrl` | User subscribes |
| `charge.succeeded` | `amount`, `protocolFee`, `txHash` | Recurring payment collected |
| `charge.failed` | `reason` | Payment failed (balance/allowance) |
| `policy.revoked` | `endTime` | User cancelled |
| `policy.cancelled_by_failure` | `consecutiveFailures`, `endTime` | Auto-cancelled after 3 failures |
| `policy.completed` | `totalSpent`, `chargeCount` | Spending cap reached |

### Testing webhooks locally

```ts
import { signPayload } from '@autopayprotocol/sdk'

const body = JSON.stringify({ type: 'charge.succeeded', timestamp: new Date().toISOString(), data: { ... } })
const signature = signPayload(body, 'your-test-secret')

await fetch('http://localhost:3000/webhook/autopay', {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain', 'x-autopay-signature': signature },
  body,
})
```

## USDC helpers

```ts
import { parseUSDC, formatUSDC, calculateFeeBreakdown } from '@autopayprotocol/sdk'

// Human-readable → raw amount (6 decimals)
parseUSDC(9.99)  // "9990000"

// Raw amount → human-readable
formatUSDC('9990000')  // "9.99"

// Fee breakdown (protocol fee is 2.5%)
const fees = calculateFeeBreakdown('9990000')
// { total: "9.99", merchantReceives: "9.74", protocolFee: "0.25", feePercentage: "2.5%" }
```

## Plan metadata

Create and validate the JSON metadata that describes your plan on the checkout page:

```ts
import { createMetadata, validateMetadata } from '@autopayprotocol/sdk'

const metadata = createMetadata({
  planName: 'Pro',
  planDescription: 'All premium features',
  merchantName: 'Acme Corp',
  amount: '9.99',
  interval: 'monthly',
  cap: '119.88',
  features: ['Unlimited access', 'Priority support'],
  website: 'https://acme.com',
  color: '#6366F1',
  badge: 'Most Popular',
})

const { valid, errors } = validateMetadata(metadata)
```

## Constants

```ts
import { intervals, chains, PROTOCOL_FEE_BPS, USDC_DECIMALS } from '@autopayprotocol/sdk'

intervals.monthly    // 2592000 (seconds)
intervals.weekly     // 604800
intervals.custom(3, 'months') // 7776000

chains.base.chainId              // 8453
chains.base.checkoutBaseUrl      // "https://autopayprotocol.com"
chains.flowEvm.chainId           // 747
chains.flowEvm.checkoutBaseUrl   // "https://flow.autopayprotocol.com"
chains.baseSepolia.chainId       // 84532
chains.baseSepolia.checkoutBaseUrl // "https://staging.autopayprotocol.com"

PROTOCOL_FEE_BPS   // 250 (2.5%)
USDC_DECIMALS      // 6
```

## Full API reference

### Checkout

| Function | Description |
|----------|-------------|
| `createCheckoutUrl(options)` | Build a checkout URL with validation |
| `createCheckoutUrlFromPlan(options)` | Build from a relayer-hosted plan (fetches billing params, prefers IPFS metadata) |
| `resolvePlan(options)` | Fetch a plan from the relayer and return structured billing data |
| `parseSuccessRedirect(queryString)` | Parse `policyId` and `txHash` from the success redirect |
| `resolveInterval(preset \| seconds)` | Convert interval preset to seconds |

### Webhooks

| Function | Description |
|----------|-------------|
| `verifyWebhook(body, signature, secret)` | Verify + parse webhook into a typed event |
| `verifySignature(payload, signature, secret)` | Verify HMAC-SHA256 signature only |
| `signPayload(payload, secret)` | Sign a payload (for testing) |

### Amounts

| Function | Description |
|----------|-------------|
| `formatUSDC(rawAmount)` | `"9990000"` → `"9.99"` |
| `parseUSDC(amount)` | `9.99` → `"9990000"` |
| `calculateFeeBreakdown(rawAmount)` | Total, merchant receives, protocol fee |
| `formatInterval(seconds)` | `2592000` → `"monthly"` |

### Metadata

| Function | Description |
|----------|-------------|
| `validateMetadata(data)` | Validate against the metadata schema |
| `createMetadata(options)` | Build a valid metadata object |

### Error classes

| Class | Thrown when |
|-------|-----------|
| `AutoPayWebhookError` | Webhook signature verification fails |
| `AutoPayCheckoutError` | Invalid checkout parameters |
| `AutoPayMetadataError` | Invalid metadata structure |

## License

Apache-2.0
