# Merchant Server (Example) — Environment Variables

## Required

| Variable | Description | Example |
|----------|-------------|---------|
| `MERCHANT_ADDRESS` | Your wallet address (receives payments) | `0x2B8b...` |
| `SUPABASE_KEY` | Supabase service role key (for subscriber database) | `eyJ...` |

## Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3002` |
| `CHAIN` | Chain preset: `base`, `flowEvm`, or `baseSepolia`. Sets RPC_URL, POLICY_MANAGER, and CHECKOUT_URL automatically. | `base` |
| `CHECKOUT_URL` | AutoPay checkout page URL (overrides `CHAIN` preset) | Derived from `CHAIN` |
| `RELAYER_URL` | Relayer API URL (for plan metadata) | `http://localhost:3420` |
| `WEBHOOK_SECRET` | Shared secret for verifying relayer webhooks | `test-secret-123` |
| `RPC_URL` | RPC URL for on-chain verification (overrides `CHAIN` preset) | Derived from `CHAIN` |
| `POLICY_MANAGER` | PolicyManager contract address (overrides `CHAIN` preset) | Derived from `CHAIN` |
| `SUPABASE_URL` | Supabase project URL | `https://your-project.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon key (for frontend auth) | `eyJ...` |

## Environments

### Local Development (Base Sepolia testnet)

```env
MERCHANT_ADDRESS=0x...
CHAIN=baseSepolia
RELAYER_URL=http://localhost:3420
WEBHOOK_SECRET=test-secret-123
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJ...
PORT=3002
```

### Production (Base mainnet)

```env
MERCHANT_ADDRESS=0x...
CHAIN=base
RELAYER_URL=https://your-relayer-domain.com
WEBHOOK_SECRET=<strong-random-secret>
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJ...
PORT=3002
```

### Production (Flow EVM)

```env
MERCHANT_ADDRESS=0x...
CHAIN=flowEvm
RELAYER_URL=https://your-relayer-domain.com
WEBHOOK_SECRET=<strong-random-secret>
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJ...
PORT=3002
```
