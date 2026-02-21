# Merchant Server (Example) — Environment Variables

## Required

| Variable | Description | Example |
|----------|-------------|---------|
| `MERCHANT_ADDRESS` | Your wallet address on Flow EVM (receives payments) | `0x2B8b...` |
| `SUPABASE_KEY` | Supabase service role key (for subscriber database) | `eyJ...` |

## Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3002` |
| `CHECKOUT_URL` | AutoPay checkout page URL | `http://localhost:5173/checkout` |
| `RELAYER_URL` | Relayer API URL (for plan metadata) | `http://localhost:3420` |
| `WEBHOOK_SECRET` | Shared secret for verifying relayer webhooks | `test-secret-123` |
| `RPC_URL` | Flow EVM RPC URL (for on-chain verification) | `https://mainnet.evm.nodes.onflow.org` |
| `POLICY_MANAGER` | PolicyManager contract address on Flow EVM | `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345` |
| `SUPABASE_URL` | Supabase project URL | `https://your-project.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon key (for frontend auth) | `eyJ...` |

## Environments

### Local Development

```env
MERCHANT_ADDRESS=0x...
CHECKOUT_URL=http://localhost:5173/checkout
RELAYER_URL=http://localhost:3420
WEBHOOK_SECRET=test-secret-123
RPC_URL=https://mainnet.evm.nodes.onflow.org
POLICY_MANAGER=0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJ...
PORT=3002
```

### Production

```env
MERCHANT_ADDRESS=0x...
CHECKOUT_URL=https://autopayprotocol.com/checkout
RELAYER_URL=https://your-relayer-domain.com
WEBHOOK_SECRET=<strong-random-secret>
RPC_URL=https://mainnet.evm.nodes.onflow.org
POLICY_MANAGER=0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJ...
PORT=3002
```
