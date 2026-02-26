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
2. Connects their wallet via RainbowKit (MetaMask, Rabby, WalletConnect, etc.)
3. Bridges USDC from any chain if needed (via built-in LiFi widget)
4. One-time USDC approval (handled automatically)
5. Subscribes to your plan - first payment charged immediately
6. Recurring charges happen automatically each billing cycle

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
- Any address you control on the consolidation chain (Base or Flow EVM)

> **Important:** Make sure you control the private key to this address. All payments are sent directly here.

### Step 2: Connect to the Dashboard

1. Visit the AutoPay app (`autopayprotocol.com` for Base, `flow.autopayprotocol.com` for Flow EVM)
2. Connect your merchant wallet
3. Switch to **Merchant** mode using the toggle in the header

No registration required. Your wallet address is your merchant identity. Everything is self-service from the dashboard.

![Merchant mode toggle](/doc-imgs/merchant-toggle.png)

### Step 3: Create Your Subscription Plans

Use the **Plan Editor** in the dashboard to create plans with a 3-step wizard:

**Step 1 - Plan Details:**
- Plan name and description
- Tier label (e.g., "pro", "starter")
- Feature list (tag-based entry)

**Step 2 - Merchant Info:**
- Your company/project name
- Logo upload (PNG, JPEG, GIF, WebP)
- Website URL and support email
- Brand color and optional badge text (e.g., "Most Popular")

**Step 3 - Billing:**
- Charge amount in USDC
- Billing interval (daily, weekly, biweekly, monthly, quarterly, yearly)
- Spending cap (auto-calculated to 12x the charge amount if not set)

Plans start as **Draft** and can be **Published** when ready. Published plans get their metadata uploaded to IPFS (Filecoin) for immutable, verifiable storage. You can **Archive** a plan to stop new subscriptions while existing ones remain active.

![Plan editor wizard](/doc-imgs/plan-editor.png)

**What's on-chain vs off-chain:**

| On-chain (immutable) | Off-chain (metadata) |
|---|---|
| Charge amount (e.g., 15 USDC) | Plan name ("Pro Plan") |
| Billing interval (e.g., 30 days) | Description, features list |
| Spending cap (e.g., 180 USDC) | Your company name and logo |
| Merchant wallet address | Support email, website link |

### Step 4: Share Your Checkout Link

From the Plans page, click **Share** on any published plan to open the Payment Link dialog. You get:

- A **checkout URL** with all plan details pre-filled. Share it anywhere.
- **Subscriber field configuration** to choose which fields to collect (email, name, Discord, Telegram, X/Twitter, mobile) and mark each as optional or required
- A **GitHub Sponsor badge** with copyable markdown that renders a "Sponsor with AutoPay" button in your README

![Payment Link dialog](/doc-imgs/payment-link-dialog.png)

### Step 5: Configure Webhooks

Go to **Settings → Webhooks** to set up notifications. This is fully self-service:

1. Enter your webhook URL (e.g., `https://yoursite.com/webhooks/autopay`)
2. Sign with your wallet to authenticate
3. A webhook secret is generated automatically. Copy it for signature verification
4. You can rotate the secret or remove the webhook at any time

![Webhooks settings](/doc-imgs/settings-webhooks.png)

### Step 6: Handle Webhook Notifications

When subscription events occur, AutoPay sends HTTP POST requests to your webhook URL. Your backend uses these to manage customer access.

| Event | What happened | Recommended action |
|-------|--------------|-------------------|
| `policy.created` | New subscriber signed up | Grant access to your product |
| `charge.succeeded` | Recurring payment collected | Extend access for another billing period |
| `charge.failed` | Payment failed (will retry) | Optionally notify the customer to add funds |
| `policy.revoked` | Customer cancelled | Revoke access at end of current period |
| `policy.completed` | Spending cap reached, subscription complete | Revoke access (natural end of subscription) |
| `policy.cancelled_by_failure` | 3 consecutive failures, auto-cancelled | Revoke access immediately |

Each webhook includes the subscriber's wallet address, policy ID, amounts, and a cryptographic signature you can verify for security.

> **Developer needed?** Setting up a webhook endpoint requires a backend developer. Install `@autopayprotocol/sdk` for typed webhook verification, checkout URL building, and USDC amount helpers. See the **SDK Integration Guide** for implementation details.

### Step 7: Generate API Keys (Optional)

Go to **Settings → API Keys** to create keys for programmatic access:

- Keys provide read access to your subscriber data, charges, reports, and stats
- Use them in Discord bots, CRM integrations, or any server-side automation
- Each key has a label (e.g., "Discord Bot") and can be revoked at any time
- Keys use the `X-API-Key` header for authentication

![API Keys settings](/doc-imgs/settings-api-keys.png)

### Alternative: Build Your Own Checkout

Instead of sharing the hosted checkout URL, you can build a custom checkout:

1. **Use `createCheckoutUrlFromPlan()`** - Build checkout URLs directly from relayer-managed plans (fetches plan data and uses the IPFS metadata URL when available):
   ```typescript
   import { createCheckoutUrlFromPlan } from '@autopayprotocol/sdk'
   const url = await createCheckoutUrlFromPlan({
     relayerUrl: 'https://relayer.autopayprotocol.com',
     merchant: '0xYOUR_ADDRESS',
     planId: 'pro',
     successUrl: 'https://yoursite.com/success',
     cancelUrl: 'https://yoursite.com/cancel',
   })
   ```
2. **Build your own** - See the **Merchant Checkout Example** for a full merchant server with checkout links

---

## Merchant Dashboard

The merchant dashboard provides a full self-service UI for managing your subscription business. Access it by connecting your merchant wallet and switching to **Merchant** mode.

### Overview

The overview page shows at a glance:
- Total plans (active + draft)
- Active subscriber count
- Total revenue earned
- Recent plans with status badges

![Merchant overview](/doc-imgs/merchant-overview.png)

### Plan Management

Create and manage subscription plans through a visual editor:

- **Draft** plans while you configure pricing, features, and branding
- **Publish** plans to make them available for checkout. Metadata is uploaded to IPFS (Filecoin) for immutable storage.
- **Archive** plans to stop new subscriptions while keeping existing ones active
- **Share** payment links and GitHub sponsor badges from any published plan

Each plan has a composite key of `(planId, merchantAddress)`, so different merchants can use the same plan slug (e.g., "pro").

![Plans page](/doc-imgs/plans-page.png)

### Subscribers

View and manage your subscriber base:

- Paginated list of all subscribers with wallet addresses, plan, amount, and status
- **Filter by plan** or **filter by status** (active / cancelled)
- Expandable rows showing custom form data (email, Discord, etc.)
- **Export CSV** with all subscriber data and custom fields

![Subscribers page](/doc-imgs/subscribers-page.png)

### Reports

Monthly reports with detailed analytics:

- **Net revenue**, gross revenue, and protocol fees for each period
- **Charge stats**: total charges, success rate, pass/fail counts
- **Subscriber stats**: active count, churn rate, new/cancelled breakdown
- **Top plans** ranked by revenue with subscriber counts
- **Download CSV** for accounting
- **Archive to Filecoin** for immutable, verifiable record-keeping

![Reports page](/doc-imgs/reports-page.png)

### Receipts

Charge receipt management with IPFS archival:

- View all successful charges with amounts, fees, and transaction hashes
- Select charges and **batch upload to IPFS** (Filecoin) for immutable receipts
- View uploaded receipts via IPFS gateway links

![Receipts page](/doc-imgs/receipts-page.png)

### Settings

Four configuration tabs:

| Tab | What it does |
|-----|-------------|
| **API Reference** | Browse all available endpoints with an interactive simulator. Try any GET endpoint live with auto-generated temp API keys |
| **API Keys** | Create, label, and revoke API keys for programmatic access (`X-API-Key` header) |
| **Custom Relayer** | Override the relayer URL for self-hosted setups (saved to browser) |
| **Webhooks** | Configure your webhook URL, view/rotate the signing secret, test delivery |

![API Reference tab](/doc-imgs/settings-api-reference.png)

### Authentication

The dashboard uses EIP-191 wallet signature authentication. Merchants sign a nonce with their wallet to prove ownership. Plan management and webhook configuration require this signature-based auth, while read-only data endpoints accept API keys.

---

## Managing Your Business

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

See the **SDK Integration Guide** for full details.

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

See the **Relayer Deployment** guide for setup instructions. A basic deployment costs $5–20/month on Railway or Docker.

---

## Relayer as a Service (Planned)

> **This feature is not yet available.** Currently, merchants either use the AutoPay-hosted relayer or self-host their own instance.

Don't want to self-host? **Relayer as a Service** will be a managed relayer that you can deploy from the AutoPay dashboard.

Self-hosting remains free. You only pay the 2.5% protocol fee on charges. See the **Relayer Deployment** guide for self-hosting instructions.

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

AutoPay deploys to **consolidation chains** (EVM chains where subscriptions settle). Currently live on **Base Mainnet** (primary) and **Flow EVM Mainnet**. Subscribers can bridge USDC from 30+ chains (Ethereum, Arbitrum, Polygon, Optimism, Avalanche, and more) via the built-in [LiFi](https://li.fi) bridge widget.

</details>

<details>
<summary>Is there a minimum subscription amount?</summary>

The smart contract accepts any amount greater than 0 USDC. Practically, very small amounts (under $1) may not be worth the protocol fee. There is no maximum.

</details>
