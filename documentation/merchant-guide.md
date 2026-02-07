# Merchant Guide

This guide is for businesses and creators who want to accept recurring crypto payments through AutoPay. No blockchain experience required.

---

## Why AutoPay?

| | Traditional Billing (Stripe) | AutoPay |
|---|---|---|
| **Transaction fee** | 2.9% + $0.30 | 2.5% flat |
| **Monthly platform fee** | $0–25+ | None |
| **Chargebacks / disputes** | Yes (costly) | No |
| **Settlement** | 2–7 business days | Instant (USDC on-chain) |
| **Currency** | Fiat (USD, EUR, etc.) | USDC (stablecoin, pegged 1:1 to USD) |
| **Geographic restrictions** | Yes (per-country compliance) | Global |
| **Customer data required** | Name, email, card number | Wallet address only |
| **Refund process** | Platform-managed | Direct (merchant-to-customer) |

### Who Is It For?

- Crypto newsletters and research (Bankless, The Defiant style)
- DAO memberships and governance access
- Trading signal groups and alpha communities
- Crypto-native SaaS tools and APIs
- Any digital service with a crypto-savvy audience

---

## How It Works

### The Subscriber Experience

1. Subscriber visits your checkout page
2. Creates a wallet with a passkey (Face ID / fingerprint) - no MetaMask, no seed phrase
3. One-time USDC approval (handled automatically)
4. Subscribes to your plan - first payment charged immediately
5. Recurring charges happen automatically each billing cycle

### What You Receive

Each billing cycle, the relayer (AutoPay's background service) automatically:

1. Charges the subscriber's wallet
2. Sends USDC directly to your merchant wallet (minus 2.5% protocol fee)
3. Sends your server a **webhook notification** with payment details

You use the webhook to grant, extend, or revoke access to your product.

### Payment Example

For a $15/month plan:

| | Amount |
|---|---|
| Subscriber pays | 15.00 USDC |
| You receive | 14.625 USDC |
| Protocol fee (2.5%) | 0.375 USDC |

Settlement is instant - USDC arrives in your wallet with each charge.

---

## Getting Started

### Step 1: Get a Merchant Wallet

You need an Ethereum-compatible wallet address to receive payments. This can be:

- A hardware wallet (Ledger, Trezor)
- A software wallet (MetaMask, Coinbase Wallet)
- A multisig (Safe)
- Any address you control on Arc Testnet

> **Important:** Make sure you control the private key to this address. All payments are sent directly here.

### Step 2: Register with the Relayer

Contact the relayer operator (or self-host - see [Deployment Guide](./relayer-deployment.md)) to register your merchant. Registration requires:

| Item | Description |
|------|-------------|
| **Wallet address** | Where you receive USDC payments |
| **Webhook URL** | Your server endpoint for payment notifications |
| **Webhook secret** | A shared secret for verifying notification authenticity |

The operator runs:

```
merchant:add --address 0xYOUR_ADDRESS --webhook-url https://yoursite.com/webhooks/autopay --webhook-secret your_secret
```

### Step 3: Set Up Your Subscription Plans

Each subscription plan needs **metadata** - the display information subscribers see during checkout:

```json
{
  "version": "1.0",
  "plan": {
    "name": "Pro Plan",
    "description": "Everything you need to succeed",
    "tier": "pro",
    "features": [
      "Unlimited API calls",
      "Priority support",
      "Advanced analytics"
    ]
  },
  "merchant": {
    "name": "Your Company Name",
    "logo": "your-logo.png",
    "website": "https://yoursite.com",
    "supportEmail": "support@yoursite.com"
  }
}
```

The relayer operator registers this metadata and provides you with a **metadata URL** (e.g., `https://relayer.example.com/metadata/pro-plan`). This URL is embedded in the subscription when a customer signs up.

**What's on-chain vs off-chain:**

| On-chain (immutable) | Off-chain (metadata) |
|---|---|
| Charge amount (e.g., 15 USDC) | Plan name ("Pro Plan") |
| Billing interval (e.g., 30 days) | Description, features list |
| Spending cap (e.g., 180 USDC) | Your company name and logo |
| Merchant wallet address | Support email, website link |

### Step 4: Handle Webhook Notifications

When subscription events occur, AutoPay sends HTTP POST requests to your webhook URL. Your backend uses these to manage customer access.

| Event | What happened | Recommended action |
|-------|--------------|-------------------|
| `policy.created` | New subscriber signed up | Grant access to your product |
| `charge.succeeded` | Recurring payment collected | Extend access for another billing period |
| `charge.failed` | Payment failed (will retry) | Optionally notify the customer to add funds |
| `policy.revoked` | Customer cancelled | Revoke access at end of current period |
| `policy.cancelled_by_failure` | 3 consecutive failures, auto-cancelled | Revoke access immediately |

Each webhook includes the subscriber's wallet address, policy ID, amounts, and a cryptographic signature you can verify for security.

> **Developer needed?** Setting up a webhook endpoint requires a backend developer. Install `@autopayprotocol/sdk` for typed webhook verification, checkout URL building, and USDC amount helpers. See the [Backend Integration Guide](./sdk-backend.md) for implementation details.

### Step 5: Build or Embed a Checkout Page

You have two options:

1. **Use the AutoPay frontend** - Point subscribers to the hosted checkout with your plan details pre-filled
2. **Build your own** - See the [Checkout Example](./merchant-checkout-example.md) for a full merchant server with checkout links

---

## Managing Your Business

### Viewing Subscribers

The relayer tracks all subscription data. You can:

- Query the database for active subscribers, churn, and revenue
- Use the API endpoint (`/metadata`) to verify your plans are set up correctly
- Check the relayer health endpoint to ensure the service is running

### Handling Failed Payments

When a subscriber's wallet has insufficient USDC:

1. **Automatic retries** - The relayer retries the charge (standard: 3 attempts over ~20 minutes)
2. **Webhook notification** - You receive a `charge.failed` event with the reason
3. **Customer communication** - Consider emailing or notifying the subscriber to add funds
4. **Auto-cancellation** - After 3 consecutive billing cycles with failed charges, the subscription is cancelled on-chain

### Offering Multiple Plans

You can create as many subscription plans as you need:

| Plan | Amount | Interval | Cap |
|------|--------|----------|-----|
| Starter | 5 USDC | 30 days | 60 USDC |
| Pro | 15 USDC | 30 days | 180 USDC |
| Enterprise | 100 USDC | 30 days | 1,200 USDC |
| Weekly Alpha | 3 USDC | 7 days | 156 USDC |

Each plan gets its own metadata entry with a unique ID.

### Refunds

AutoPay does not have a built-in refund mechanism. To refund a subscriber:

1. Send USDC directly from your merchant wallet to the subscriber's wallet address
2. The subscriber's wallet address is included in every webhook payload

Keep records of any refunds you issue for your own accounting.

---

## Revenue & Fees

### Fee Structure

- **2.5% per charge** - deducted automatically before you receive payment
- **No monthly fees** - you only pay when you earn
- **No setup fees** - registration is free
- **No minimum volume** - works for 1 subscriber or 10,000

### Revenue Examples

| Subscribers | Plan Price | Monthly Revenue (after fees) |
|-------------|-----------|------------------------------|
| 50 | 10 USDC | 487.50 USDC |
| 200 | 10 USDC | 1,950 USDC |
| 500 | 15 USDC | 7,312.50 USDC |
| 1,000 | 15 USDC | 14,625 USDC |
| 5,000 | 10 USDC | 48,750 USDC |

### Compared to Stripe

For a merchant processing $10,000/month:

| | Stripe | AutoPay |
|---|---|---|
| Fee | ~$320 (3.2%) | $250 (2.5%) |
| Settlement | 2–7 days | Instant |
| Chargebacks | Risk of loss | None |
| **Monthly savings** | - | **$70+** |

---

## Security Considerations

### Webhook Verification

Every webhook from AutoPay includes an HMAC-SHA256 signature in the `X-AutoPay-Signature` header. Always verify this signature to ensure notifications are genuine. The `@autopayprotocol/sdk` package handles this in one line:

```typescript
import { verifyWebhook } from '@autopayprotocol/sdk'
const event = verifyWebhook(rawBody, req.headers['x-autopay-signature'], secret)
```

See the [Backend Integration Guide](./sdk-backend.md#signature-verification) for full details.

### Wallet Security

Your merchant wallet receives all subscription payments. Protect it accordingly:

- Use a hardware wallet or multisig for production
- Never share your private key
- Consider a separate wallet for AutoPay to isolate funds

### Subscriber Privacy

AutoPay requires only a wallet address - no names, emails, or card numbers are collected on-chain. If you need customer contact info, collect it separately through your own registration flow.

---

## Self-Hosting

For full control, you can run your own relayer instance. This gives you:

- Direct database access for custom reporting
- No dependency on a shared relayer service
- Ability to customize retry behavior and charge timing
- Your own API and health monitoring

See the [Deployment Guide](./relayer-deployment.md) for setup instructions. A basic deployment costs $5–20/month on Railway or Docker.

---

## Relayer as a Service (Coming Soon)

> **This feature is not yet available.** Join the waitlist to be notified when it launches.

Don't want to self-host? **Relayer as a Service** is a managed relayer that you can deploy in one click from the AutoPay dashboard.

### What You Get

- **One-click deploy** — Spin up a dedicated relayer instance without touching infrastructure
- **Dashboard config** — Manage webhook URLs, retry settings, merchant metadata, and plan configuration through a web UI
- **Monitoring** — Built-in health checks, charge history, and failure alerts
- **Auto-scaling** — Your relayer scales with your subscriber count
- **Zero maintenance** — We handle updates, uptime, and database backups

### How It Works

1. Connect your merchant wallet in the AutoPay dashboard
2. Click **Deploy Relayer**
3. Configure your webhook URL and plans through the UI
4. Share your checkout link — everything else is handled for you

### Pricing

Relayer as a Service will be billed monthly based on usage (active subscriptions and charges processed). Self-hosting remains free — you only pay the 2.5% protocol fee on charges.

---

## FAQ

<details>
<summary>Do I need to understand blockchain to use AutoPay?</summary>

For basic setup, no. You need a wallet address and a backend that handles webhook notifications. The blockchain details are abstracted away. For custom integrations, basic familiarity with Ethereum addresses and USDC helps.

</details>

<details>
<summary>What is USDC?</summary>

USDC is a stablecoin pegged 1:1 to the US dollar, issued by Circle. 1 USDC = $1 USD. It's the most widely used stablecoin for payments.

</details>

<details>
<summary>How do I convert USDC to fiat?</summary>

Transfer USDC from your merchant wallet to a centralized exchange (Coinbase, Kraken, etc.) and sell for USD, EUR, or your local currency. Many exchanges offer instant USDC-to-fiat conversion.

</details>

<details>
<summary>Can subscribers chargeback a payment?</summary>

No. Crypto payments are final. There is no chargeback mechanism, which eliminates a major cost and risk for merchants.

</details>

<details>
<summary>What if the relayer goes down?</summary>

No charges are executed while the relayer is offline. When it restarts, it catches up on any missed charges automatically. Subscribers are not charged twice. If you self-host, set up health monitoring to catch outages early.

</details>

<details>
<summary>Can I change the price of a plan?</summary>

You cannot change the price of existing subscriptions - the charge amount is locked on-chain. To change pricing, create a new plan and ask existing subscribers to cancel and re-subscribe. This protects subscribers from unexpected price increases.

</details>

<details>
<summary>What chains are supported?</summary>

Subscribers can pay from any of 12+ supported chains (Ethereum, Arbitrum, Base, Polygon, Solana, Avalanche, and more) via [Circle Gateway](https://developers.circle.com/gateway/references/supported-blockchains). Funds are automatically bridged to your wallet on Arc.

</details>

<details>
<summary>Is there a minimum subscription amount?</summary>

The smart contract accepts any amount greater than 0 USDC. Practically, very small amounts (under $1) may not be worth the protocol fee. There is no maximum.

</details>
