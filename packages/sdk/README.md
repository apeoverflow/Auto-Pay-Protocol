# @autopayprotocol/sdk

Server-side utility package for merchants integrating with [AutoPay Protocol](https://autopay.xyz).

This SDK does **not** interact with the blockchain or manage wallets. It provides typed, zero-dependency helpers for the things merchants need on their backend: building checkout URLs, verifying webhook signatures, and working with USDC amounts/intervals.

## Install

```bash
npm install @autopayprotocol/sdk
```

## Quick Start

### Build a checkout URL

```typescript
import { createCheckoutUrl } from '@autopayprotocol/sdk'

const url = createCheckoutUrl({
  merchant: '0x2B8b9182c1c3A9bEf4a60951D9B7F49420D12B9B',
  amount: 9.99,
  interval: 'monthly',
  metadataUrl: 'https://mysite.com/plans/pro.json',
  successUrl: 'https://mysite.com/success',
  cancelUrl: 'https://mysite.com/cancel',
  spendingCap: 119.88,
})
```

### Verify webhooks

```typescript
import { verifyWebhook } from '@autopayprotocol/sdk'

const event = verifyWebhook(rawBody, req.headers['x-autopay-signature'], secret)

if (event.type === 'charge.succeeded') {
  console.log(event.data.amount)      // TypeScript knows this exists
  console.log(event.data.protocolFee)
  console.log(event.data.txHash)
}
```

## API

### Checkout

| Function | Description |
|----------|-------------|
| `createCheckoutUrl(options)` | Build a checkout URL with validation |
| `parseSuccessRedirect(queryString)` | Parse `policyId` and `txHash` from success redirect |
| `resolveInterval(preset \| seconds)` | Convert interval preset to seconds |

### Webhooks

| Function | Description |
|----------|-------------|
| `verifyWebhook(body, signature, secret)` | Verify + parse webhook (discriminated union) |
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
| `validateMetadata(data)` | Validate JSON against metadata schema |
| `createMetadata(options)` | Create a valid metadata object |

### Constants

| Export | Value |
|--------|-------|
| `intervals.minute` | `60` |
| `intervals.weekly` | `604_800` |
| `intervals.biweekly` | `1_209_600` |
| `intervals.monthly` | `2_592_000` |
| `intervals.quarterly` | `7_776_000` |
| `intervals.yearly` | `31_536_000` |
| `intervals.custom(count, unit)` | Custom interval — units: `'minutes'`, `'hours'`, `'days'`, `'months'`, `'years'` |
| `PROTOCOL_FEE_BPS` | `250` (2.5%) |
| `USDC_DECIMALS` | `6` |
| `MIN_INTERVAL` | `60` (1 minute) |
| `MAX_INTERVAL` | `31_536_000` (365 days) |
| `MAX_RETRIES` | `3` |
| `DEFAULT_CHECKOUT_BASE_URL` | `'https://app.autopay.xyz'` |
| `chains` | Chain configs (Polygon Amoy, Arbitrum Sepolia, Arc Testnet) |

### Error Classes

| Class | Code |
|-------|------|
| `AutoPayError` | Base error with `code` property |
| `AutoPayWebhookError` | `'WEBHOOK_VERIFICATION_FAILED'` |
| `AutoPayCheckoutError` | `'INVALID_CHECKOUT_PARAMS'` |
| `AutoPayMetadataError` | `'INVALID_METADATA'` |

### Webhook Event Types

All events share `{ type, timestamp, data: { policyId, chainId, payer, merchant } }` plus event-specific fields:

| Event | Extra Fields |
|-------|-------------|
| `charge.succeeded` | `amount`, `protocolFee`, `txHash` |
| `charge.failed` | `reason` |
| `policy.created` | `chargeAmount`, `interval`, `spendingCap`, `metadataUrl` |
| `policy.revoked` | `endTime` |
| `policy.cancelled_by_failure` | `consecutiveFailures`, `endTime` |

### Exported Types

`CheckoutOptions`, `SuccessRedirect`, `IntervalPreset`, `WebhookEvent`, `WebhookEventType`, `ChargeSucceededEvent`, `ChargeFailedEvent`, `PolicyCreatedEvent`, `PolicyRevokedEvent`, `PolicyCancelledByFailureEvent`, `CheckoutMetadata`, `FeeBreakdown`, `MetadataValidationResult`, `ChainConfig`

## Zero Dependencies

This package has **zero runtime dependencies**. It only uses Node.js built-in `crypto`.

## License

Apache-2.0
