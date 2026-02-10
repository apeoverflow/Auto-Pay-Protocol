# Merchant Checkout Demo

A Stripe-like checkout flow for AutoPay. Demonstrates how a merchant generates checkout links and how users subscribe through the hosted checkout page at `/checkout` in the main frontend.

## Architecture

```
Merchant Server (:3002)              autopayprotocol.com/checkout         On-chain
─────────────────────                ──────────────────────────────      ────────

GET / (plan cards)
    │
    └──> User clicks ──────────────> Parses query params
         "Subscribe" link            Fetches plan metadata
                                     Shows plan summary
                                     Auth (passkey)
                                     Wallet setup (USDC approval)
                                     User clicks "Subscribe" ──────────> createPolicy()
                                     Processing...                        (first charge)
                                     Success! ──> redirect to
                                       success_url?policy_id=0x...
    │
    └── GET /success?policy_id=
         "Subscription confirmed!"
```

## Quick Start

### Prerequisites

- Node.js 18+
- A Circle Modular Wallets API key ([console.circle.com](https://console.circle.com))
- Testnet USDC on Arc Testnet (use the [Circle faucet](https://faucet.circle.com/))
- The AutoPay frontend at [autopayprotocol.com](https://autopayprotocol.com)

### 1. Merchant Server

```bash
cd examples/merchant-checkout/merchant-server
npm install
npm run dev
```

Opens at [http://localhost:3002](http://localhost:3002) — shows plan cards with "Subscribe" buttons.

### 2. Try It

1. Open [http://localhost:3002](http://localhost:3002)
2. Click "Subscribe with AutoPay" on a plan
3. Walk through: register passkey → approve USDC → confirm subscription
4. After success: auto-redirects to merchant's success page with `policy_id`

## Checkout URL Format

The merchant generates a URL with these query params:

```
https://autopayprotocol.com/checkout?merchant=0x...&metadata_url=http://localhost:3002/metadata/pro-plan&success_url=http://localhost:3002/success&cancel_url=http://localhost:3002/cancel
```

| Parameter | Description |
|-----------|-------------|
| `merchant` | Merchant wallet address (receives USDC payments) |
| `metadata_url` | URL returning plan metadata JSON |
| `success_url` | Redirect URL after successful subscription |
| `cancel_url` | Redirect URL when user cancels |

## Plan Metadata Schema

The checkout page fetches plan details from `metadata_url`:

```json
{
  "version": "1.0",
  "plan": {
    "name": "Pro Plan",
    "description": "Full access to all premium features",
    "features": ["Unlimited projects", "Priority support"]
  },
  "billing": {
    "amount": "9.99",
    "currency": "USDC",
    "interval": 60,
    "spending_cap": "119.88"
  },
  "merchant": {
    "name": "DemoApp"
  },
  "display": {
    "color": "#6366F1",
    "badge": "Most Popular"
  }
}
```

## Checkout Flow (State Machine)

```
LOADING → PLAN_SUMMARY → AUTH → WALLET_SETUP → CONFIRM → PROCESSING → SUCCESS → redirect
                ↑                                   ↑
                │ (already logged in)               │ (already approved)
                └───────────────────────────────────┘
```

## Webhooks

The merchant server includes a `/webhook` endpoint for relayer notifications. See the [webhook-receiver example](../webhook-receiver/) for the full reference implementation.

## File Structure

```
examples/merchant-checkout/
├── README.md
└── merchant-server/              # Express merchant backend
    ├── package.json
    ├── server.js
    ├── .env.example
    ├── metadata/                 # Plan JSON files
    │   ├── pro-plan.json
    │   └── basic-plan.json
    └── public/                   # Static HTML pages
        ├── index.html            # Plan cards with checkout links
        ├── success.html          # Post-checkout callback
        └── cancel.html           # Cancellation callback
```

The checkout UI lives in the main frontend at `frontend/src/pages/CheckoutPage.tsx` with step components in `frontend/src/components/checkout/`.
