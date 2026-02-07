# AutoPay Webhook Receiver

Example backend service that receives webhook notifications from the AutoPay relayer. This is what a merchant would run to get notified about subscription events.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WEBHOOK FLOW                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐     │
│  │   Relayer    │────►│   Webhook    │────►│   Your Backend       │     │
│  │              │     │   Receiver   │     │   (This Service)     │     │
│  └──────────────┘     └──────────────┘     └──────────────────────┘     │
│                                                                         │
│  Events:                                                                │
│  • charge.succeeded  →  Grant/continue access                           │
│  • charge.failed     →  Notify user, grace period                       │
│  • policy.created    →  Create account, grant access                    │
│  • policy.revoked    →  Revoke access at period end                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Install Dependencies

```bash
cd examples/webhook-receiver
npm install
```

### 2. Start the Webhook Receiver

```bash
npm run dev
```

The server will start on `http://localhost:3500`.

### 3. Register Your Merchant

Register your merchant's webhook URL with the relayer so it knows where to send events. This is done via the relayer's merchant registration API or CLI — see the [SDK Integration Guide](../../documentation/sdk-backend.md) for details.

---

## Webhook Events

### `charge.succeeded`

Sent when a subscription payment is successfully collected.

```json
{
  "event": "charge.succeeded",
  "timestamp": "2026-02-05T12:00:00Z",
  "data": {
    "policyId": "0x1234...abcd",
    "chainId": 5042002,
    "payer": "0xabc...123",
    "merchant": "0xdef...456",
    "amount": "10000000",
    "protocolFee": "250000",
    "txHash": "0x789...xyz"
  }
}
```

| Field | Description |
|-------|-------------|
| `policyId` | Unique subscription identifier |
| `chainId` | Blockchain chain ID (5042002 = Arc Testnet) |
| `payer` | Subscriber's wallet address |
| `merchant` | Your merchant address |
| `amount` | Amount charged in USDC (6 decimals, so 10000000 = 10 USDC) |
| `protocolFee` | Protocol fee deducted (2.5%) |
| `txHash` | Transaction hash on blockchain |

**Action:** Grant or continue access to your product/service.

---

### `charge.failed`

Sent when a subscription payment fails.

```json
{
  "event": "charge.failed",
  "timestamp": "2026-02-05T12:00:00Z",
  "data": {
    "policyId": "0x1234...abcd",
    "chainId": 5042002,
    "payer": "0xabc...123",
    "merchant": "0xdef...456",
    "reason": "Insufficient balance"
  }
}
```

| Field | Description |
|-------|-------------|
| `reason` | Why the charge failed (e.g., insufficient balance, revoked approval) |

**Action:** Notify user, consider a grace period before revoking access.

---

### `policy.created`

Sent when a new subscription is created.

```json
{
  "event": "policy.created",
  "timestamp": "2026-02-05T12:00:00Z",
  "data": {
    "policyId": "0x1234...abcd",
    "chainId": 5042002,
    "payer": "0xabc...123",
    "merchant": "0xdef...456",
    "chargeAmount": "10000000",
    "interval": 2592000,
    "spendingCap": "120000000",
    "metadataUrl": "https://example.com/plan/pro"
  }
}
```

| Field | Description |
|-------|-------------|
| `chargeAmount` | Amount per billing cycle (USDC, 6 decimals) |
| `interval` | Billing interval in seconds (2592000 = 30 days) |
| `spendingCap` | Maximum total that can be charged |
| `metadataUrl` | URL with subscription plan details |

**Action:** Create user account, grant initial access. Note: First charge happens immediately on policy creation.

---

### `policy.revoked`

Sent when a subscription is cancelled by the user.

```json
{
  "event": "policy.revoked",
  "timestamp": "2026-02-05T12:00:00Z",
  "data": {
    "policyId": "0x1234...abcd",
    "chainId": 5042002,
    "payer": "0xabc...123",
    "merchant": "0xdef...456",
    "endTime": 1738713600
  }
}
```

| Field | Description |
|-------|-------------|
| `endTime` | Unix timestamp when policy was revoked |

**Action:** Revoke access at end of current billing period (they already paid for it).

---

## Signature Verification

All webhooks include an HMAC-SHA256 signature for security.

### Headers

| Header | Description |
|--------|-------------|
| `X-AutoPay-Signature` | HMAC-SHA256 signature of the payload |
| `X-AutoPay-Timestamp` | ISO timestamp when webhook was sent |

### Verification Code

```javascript
import { createHmac } from 'crypto'

function verifySignature(payload, signature, secret) {
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return expected === signature
}

// In your webhook handler:
const signature = req.headers['x-autopay-signature']
const body = await req.text() // raw body string

if (!verifySignature(body, signature, process.env.WEBHOOK_SECRET)) {
  return new Response('Invalid signature', { status: 401 })
}
```

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WEBHOOK_SECRET` | Recommended | Secret for signature verification |
| `PORT` | Optional | Server port (default: 3500) |

### Customizing the Port

Edit `server.js` line 5:
```javascript
const PORT = 3500  // Change this
```

### Customizing the Secret

Edit `server.js` line 6:
```javascript
const WEBHOOK_SECRET = 'your-webhook-secret-here'
```

---

## Production Considerations

### 1. Use HTTPS

In production, your webhook URL must use HTTPS.

### 2. Store Secret Securely

Use environment variables, not hardcoded values:
```javascript
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
```

### 3. Respond Quickly

Return 200 within 10 seconds or the relayer will retry. Do heavy processing asynchronously:
```javascript
// Good - respond immediately, process later
app.post('/webhook', (req, res) => {
  res.json({ received: true })
  processWebhookAsync(req.body) // Don't await
})
```

### 4. Handle Retries

Webhooks are retried up to 3 times with exponential backoff (1min, 5min, 15min). Make your handler idempotent using `policyId` + `event` as a deduplication key.

### 5. Verify Signatures

Always verify the `X-AutoPay-Signature` header in production to prevent spoofed webhooks.

---

## File Structure

```
examples/webhook-receiver/
├── package.json           # Dependencies
├── server.js              # Webhook receiver server
└── README.md              # This file
```

---

## Testing Locally

### 1. Start the Receiver
```bash
npm run dev
```

### 2. Send a Test Webhook
```bash
curl -X POST http://localhost:3500/webhook \
  -H "Content-Type: application/json" \
  -H "X-AutoPay-Timestamp: 2026-02-05T12:00:00Z" \
  -d '{
    "event": "charge.succeeded",
    "timestamp": "2026-02-05T12:00:00Z",
    "data": {
      "policyId": "0x1234567890abcdef",
      "chainId": 5042002,
      "payer": "0xabc123",
      "merchant": "0xdef456",
      "amount": "10000000",
      "protocolFee": "250000",
      "txHash": "0x789xyz"
    }
  }'
```

### 3. Check the Output

You should see:
```
╔════════════════════════════════════════════════════════════╗
║           AutoPay Webhook Receiver Started                 ║
╚════════════════════════════════════════════════════════════╝

📨 Incoming webhook at 2026-02-05T12:00:00Z
⚠️  Signature verification skipped (no secret configured)

============================================================
📥 WEBHOOK RECEIVED: charge.succeeded
============================================================
✅ Payment collected!
   Policy ID: 0x1234567890abcdef
   Payer: 0xabc123
   Amount: 10000000 (10 USDC)
   Protocol Fee: 250000
   Tx Hash: 0x789xyz
============================================================
```

---

## Integration Examples

### Express.js

```javascript
import express from 'express'
import { createHmac } from 'crypto'

const app = express()
app.use(express.json())

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-autopay-signature']
  const payload = JSON.stringify(req.body)

  // Verify signature
  const expected = createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')

  if (signature !== expected) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  // Handle event
  const { event, data } = req.body

  switch (event) {
    case 'charge.succeeded':
      grantAccess(data.payer, data.policyId)
      break
    case 'charge.failed':
      notifyUser(data.payer, data.reason)
      break
    case 'policy.revoked':
      scheduleAccessRevocation(data.payer, data.policyId)
      break
  }

  res.json({ received: true })
})
```

### Next.js API Route

```typescript
// app/api/webhook/route.ts
import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-autopay-signature')
  const body = await req.text()

  // Verify
  const expected = createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')

  if (signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const { event, data } = JSON.parse(body)

  // Handle event...

  return NextResponse.json({ received: true })
}
```

---

## Troubleshooting

### Webhooks Not Arriving

1. Check merchant is registered with the relayer
2. Check relayer logs for webhook errors
3. Verify your webhook URL is accessible from the relayer

### Invalid Signature Errors

1. Ensure the secret in your receiver matches what's registered with the relayer
2. Make sure you're verifying against the raw body, not parsed JSON

### Duplicate Webhooks

The relayer retries failed deliveries. Use `policyId` + event type as an idempotency key to avoid processing duplicates.
