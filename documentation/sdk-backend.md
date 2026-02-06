# Backend Integration Guide

## Overview

AutoPay notifies your backend about subscription events via webhooks. No SDK is needed -- you receive standard HTTP POST requests signed with HMAC-SHA256. Your backend handles these events to grant/revoke access to your product.

---

## Prerequisites

- Any HTTP server (Node.js, Python, Go, etc.)
- A public URL reachable from the relayer (or [ngrok](https://ngrok.com) for local testing)

---

## Quick Start

1. Register your webhook URL with the relayer operator:

```bash
npm run cli -- merchant:add \
  --address 0xYOUR_MERCHANT_ADDRESS \
  --webhook-url https://yoursite.com/webhooks/autopay \
  --webhook-secret your_secret_here
```

2. Handle incoming webhooks on your server:

```javascript
import { createServer } from 'http'
import { createHmac, timingSafeEqual } from 'crypto'

const WEBHOOK_SECRET = 'your_secret_here'

createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhooks/autopay') {
    let body = ''
    req.on('data', chunk => { body += chunk.toString() })
    req.on('end', () => {
      // Verify signature
      const signature = req.headers['x-autopay-signature']
      const expected = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')
      if (!signature || signature.length !== expected.length ||
          !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        res.writeHead(401)
        res.end()
        return
      }

      const { event, data } = JSON.parse(body)
      console.log(`Received: ${event}`, data)

      // Always respond 200 to acknowledge receipt
      res.writeHead(200)
      res.end()
    })
  }
}).listen(3500)
```

---

## Webhook Setup

Register your merchant webhook via the relayer CLI. See the [Relayer Operations Guide](./relayer-operations.md#merchant-management) for full details.

```bash
npm run cli -- merchant:add \
  --address 0xYOUR_MERCHANT_ADDRESS \
  --webhook-url https://yoursite.com/webhooks/autopay \
  --webhook-secret your_secret_here
```

Running this command again with the same address updates the existing configuration.

---

## Event Types

| Event | Description | When Sent |
|-------|-------------|-----------|
| `policy.created` | New subscription created | User subscribes to your plan |
| `charge.succeeded` | Recurring payment collected | Each billing cycle |
| `charge.failed` | Payment failed (will retry) | Insufficient balance or allowance |
| `policy.revoked` | Subscription cancelled by user | User cancels |
| `policy.cancelled_by_failure` | Auto-cancelled after 3 consecutive failures | Balance/allowance issues persist |

---

## Webhook Payload Format

Every webhook is an HTTP POST with a JSON body:

```json
{
  "event": "<event_type>",
  "timestamp": "2026-02-05T12:00:00.000Z",
  "data": {
    "policyId": "0x...",
    "chainId": 5042002,
    "payer": "0x...",
    "merchant": "0x...",
    ...
  }
}
```

### `policy.created`

```json
{
  "event": "policy.created",
  "timestamp": "2026-02-05T12:00:00.000Z",
  "data": {
    "policyId": "0x1234...abcd",
    "chainId": 5042002,
    "payer": "0xPAYER_ADDRESS",
    "merchant": "0xMERCHANT_ADDRESS",
    "chargeAmount": "10000000",
    "interval": 2592000,
    "spendingCap": "120000000",
    "metadataUrl": "https://relayer.example.com/metadata/pro-plan"
  }
}
```

### `charge.succeeded`

```json
{
  "event": "charge.succeeded",
  "timestamp": "2026-02-05T12:00:00.000Z",
  "data": {
    "policyId": "0x1234...abcd",
    "chainId": 5042002,
    "payer": "0xPAYER_ADDRESS",
    "merchant": "0xMERCHANT_ADDRESS",
    "amount": "10000000",
    "protocolFee": "250000",
    "txHash": "0xTX_HASH..."
  }
}
```

> **Note:** Amounts are in USDC's smallest unit (6 decimals). `10000000` = 10.00 USDC. The `protocolFee` (2.5%) is deducted before the merchant receives funds.

### `charge.failed`

```json
{
  "event": "charge.failed",
  "timestamp": "2026-02-05T12:00:00.000Z",
  "data": {
    "policyId": "0x1234...abcd",
    "chainId": 5042002,
    "payer": "0xPAYER_ADDRESS",
    "merchant": "0xMERCHANT_ADDRESS",
    "reason": "InsufficientBalance"
  }
}
```

### `policy.revoked`

```json
{
  "event": "policy.revoked",
  "timestamp": "2026-02-05T12:00:00.000Z",
  "data": {
    "policyId": "0x1234...abcd",
    "chainId": 5042002,
    "payer": "0xPAYER_ADDRESS",
    "merchant": "0xMERCHANT_ADDRESS",
    "endTime": 1738764000
  }
}
```

### `policy.cancelled_by_failure`

```json
{
  "event": "policy.cancelled_by_failure",
  "timestamp": "2026-02-05T12:00:00.000Z",
  "data": {
    "policyId": "0x1234...abcd",
    "chainId": 5042002,
    "payer": "0xPAYER_ADDRESS",
    "merchant": "0xMERCHANT_ADDRESS",
    "txHash": "0xTX_HASH..."
  }
}
```

---

## Signature Verification

Every webhook includes an HMAC-SHA256 signature in the `X-AutoPay-Signature` header. The signature is computed over the raw request body using your webhook secret.

### Headers

| Header | Description |
|--------|-------------|
| `X-AutoPay-Signature` | HMAC-SHA256 hex digest of the request body |
| `X-AutoPay-Timestamp` | ISO 8601 timestamp of when the webhook was sent |
| `Content-Type` | `application/json` |

### Node.js Verification

```javascript
import { createHmac, timingSafeEqual } from 'crypto'

function verifyWebhookSignature(rawBody, signature, secret) {
  const expected = createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  if (signature.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

// In your request handler:
const signature = req.headers['x-autopay-signature']
const isValid = verifyWebhookSignature(rawBody, signature, WEBHOOK_SECRET)

if (!isValid) {
  res.writeHead(401, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Invalid signature' }))
  return
}
```

---

## Handling Events

Here is a complete example showing recommended actions for each event type:

```javascript
function handleWebhook(event, data) {
  switch (event) {
    case 'policy.created':
      // New subscriber - create account or grant access
      // data.chargeAmount, data.interval, data.spendingCap available
      // First charge has already been collected at this point
      grantAccess(data.payer, data.policyId)
      break

    case 'charge.succeeded':
      // Recurring payment collected - extend access
      // data.amount = USDC collected (6 decimals)
      // data.protocolFee = 2.5% fee deducted
      // data.txHash = on-chain transaction
      extendAccess(data.payer, data.policyId)
      break

    case 'charge.failed':
      // Payment failed - will retry automatically
      // data.reason = 'InsufficientBalance' or 'InsufficientAllowance'
      // Consider notifying the user to add funds
      notifyPaymentFailed(data.payer, data.reason)
      break

    case 'policy.revoked':
      // User cancelled - revoke access at end of billing period
      // data.endTime = Unix timestamp when policy ended
      scheduleAccessRevocation(data.payer, data.policyId)
      break

    case 'policy.cancelled_by_failure':
      // Auto-cancelled after 3 consecutive failures
      // Revoke access immediately
      revokeAccess(data.payer, data.policyId)
      break
  }
}
```

---

## Retry Policy

If your webhook endpoint fails to respond with a 2xx status code, the relayer retries delivery:

| Attempt | Timing |
|---------|--------|
| 1st | Immediate |
| 2nd | After ~1 minute |
| 3rd | After ~5 minutes |

- **Timeout**: 10 seconds per attempt
- **After all retries fail**: Webhook is marked as `failed` in the database

Always respond `200` promptly to acknowledge receipt, even if you process the event asynchronously.

---

## Example: Webhook Receiver Server

A complete working example is available in `webhook-receiver/server.js`. This server:

- Listens on port 3500
- Verifies HMAC-SHA256 signatures
- Handles all event types with formatted logging
- Responds with 200 on success, 401 on invalid signature

```javascript
import { createServer } from 'http'
import { createHmac, timingSafeEqual } from 'crypto'

const PORT = 3500
const WEBHOOK_SECRET = 'test-secret-123'

function verifySignature(payload, signature, secret) {
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  if (signature.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

const server = createServer((req, res) => {
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  // Webhook endpoint
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = ''
    req.on('data', chunk => { body += chunk.toString() })
    req.on('end', () => {
      const signature = req.headers['x-autopay-signature']

      if (!signature || !verifySignature(body, signature, WEBHOOK_SECRET)) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid signature' }))
        return
      }

      try {
        const payload = JSON.parse(body)
        console.log(`Received: ${payload.event}`, payload.data)

        // Always respond 200 to acknowledge receipt
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ received: true }))
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })
    return
  }

  res.writeHead(404)
  res.end()
})

server.listen(PORT, () => {
  console.log(`Webhook receiver listening on port ${PORT}`)
})
```

---

## Testing Webhooks Locally

### Using ngrok

1. Start your webhook server:

```bash
node webhook-receiver/server.js
```

2. Expose it with ngrok:

```bash
ngrok http 3500
```

3. Register the ngrok URL with the relayer:

```bash
npm run cli -- merchant:add \
  --address 0xYOUR_MERCHANT_ADDRESS \
  --webhook-url https://abc123.ngrok.io/webhook \
  --webhook-secret test-secret-123
```

### Using the Registration Script

The `webhook-receiver/register-merchant.js` script registers a merchant directly in the database:

```bash
export DATABASE_URL=postgres://autopay:password@localhost:5432/autopay

node webhook-receiver/register-merchant.js \
  0xYOUR_MERCHANT_ADDRESS \
  http://localhost:3500/webhook \
  test-secret-123
```

---

## Troubleshooting

### Not Receiving Webhooks

1. Verify your merchant is registered: `npm run cli -- merchant:list`
2. Check the webhook URL is reachable from the relayer
3. Check the relayer logs for delivery errors
4. Query the database for webhook status:

```sql
SELECT id, event_type, status, attempts FROM webhooks
WHERE status IN ('pending', 'failed')
ORDER BY created_at DESC LIMIT 10;
```

### Invalid Signature Errors

- Ensure the `WEBHOOK_SECRET` in your server matches what was registered with `merchant:add`
- Verify you're computing the HMAC over the raw request body string, not a parsed/re-serialized JSON

### Webhook Payloads Missing Fields

Some fields are event-specific. For example, `amount` and `protocolFee` only appear on `charge.succeeded` events. Always check the event type before accessing fields.

---

## Related Documentation

- [Relayer Operations](./relayer-operations.md) - Merchant and metadata management via CLI
- [Frontend Integration Guide](./sdk-frontend.md) - Building the subscriber-facing UI
- [Configuration Reference](./relayer-configuration.md) - Webhook settings and environment variables
