# Running the Relayer Locally

## Overview

This guide walks you through setting up and running the AutoPay relayer on your local machine for development and testing. The relayer indexes policy events from the consolidation chains (Base Mainnet and Flow EVM), executes charges when subscriptions are due, and sends webhooks to merchants.

---

## Prerequisites

- **Node.js** 20+
- **Docker** (for PostgreSQL) or a managed Postgres instance
- **A funded wallet** with native tokens for gas on the consolidation chains (ETH on Base, FLOW on Flow EVM)

---

## Quick Start

```bash
cd relayer
npm install
docker run -d --name autopay-db \
  -e POSTGRES_DB=autopay -e POSTGRES_USER=autopay -e POSTGRES_PASSWORD=password \
  -p 5432:5432 postgres:16-alpine
cp .env.example .env    # then edit with your values
npm run cli -- db:migrate
npm run dev
```

---

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd relayer
npm install
```

### 2. Set Up PostgreSQL

**Option A: Docker (recommended for local dev)**

```bash
docker run -d --name autopay-db \
  -e POSTGRES_DB=autopay \
  -e POSTGRES_USER=autopay \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:16-alpine
```

Connection string: `postgres://autopay:password@localhost:5432/autopay`

**Option B: Managed Database**

Use any PostgreSQL provider:
- [Supabase](https://supabase.com) (free tier available)
- [Neon](https://neon.tech) (free tier available)
- [Railway](https://railway.app)

Copy the connection string from your provider's dashboard.

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Required
DATABASE_URL=postgres://autopay:password@localhost:5432/autopay
RELAYER_PRIVATE_KEY=0x...  # Your relayer wallet private key

# Optional: RPC overrides (falls back to public RPCs)
FLOW_EVM_RPC=https://mainnet.evm.nodes.onflow.org
BASE_RPC=https://mainnet.base.org
PORT=3001
LOG_LEVEL=info
RETRY_PRESET=standard

# Optional: restrict to specific chains (default: all enabled in chains.json)
# ENABLED_CHAINS=flowEvm,base
```

For IPFS metadata archival (optional):

```bash
# Storacha credentials (IPFS + Filecoin)
STORACHA_PRINCIPAL_KEY=...
STORACHA_DELEGATION_PROOF=...
```

See the **Configuration Reference** for all available options.

### 4. Fund Your Relayer Wallet

The relayer wallet pays gas for `charge()` transactions. Fund it with native tokens for each enabled consolidation chain (ETH on Base, FLOW on Flow EVM).

To find your relayer wallet address, start the relayer and check the logs:

```bash
npm run dev
# Look for: INFO (relayer): Relayer wallet {"wallet":"0x..."}
```

### 5. Run Database Migrations

```bash
npm run cli -- db:migrate
```

Expected output:

```
[migrations] Applying migration: 001_initial_schema.sql
[migrations] Applying migration: 002_metadata.sql
[migrations] Applying migration: 003_consecutive_failures.sql
[migrations] Applying migration: 004_filecoin_storage.sql
[migrations] Applying migration: 005_plan_status.sql
[migrations] Applying migration: 006_plan_composite_key.sql
[migrations] Applying migration: 007_report_json_cache.sql
[migrations] Applying migration: 008_subscriber_data.sql
[migrations] Applying migration: 010_merchant_api_keys.sql
[migrations] All migrations complete
```

### 6. Start the Relayer

**Development mode** (with hot reload):

```bash
npm run dev
```

**Production mode**:

```bash
npm run build
npm start
```

---

## Verify It's Working

### Check Status

```bash
npm run cli -- status
```

Expected output:

```
=== AutoPay Relayer Status ===

Base (8453):
  Last indexed block: 42560000
  Active policies: 12
  Pending charges: 1

Flow EVM (747):
  Last indexed block: 56881090
  Active policies: 5
  Pending charges: 0

Webhooks:
  Pending: 0
  Failed: 0
```

### Check Health Endpoint

```bash
curl http://localhost:3001/health
```

Expected output:

```json
{
  "status": "healthy",
  "timestamp": "2026-02-05T12:00:00Z",
  "chains": {
    "8453": {
      "name": "Base",
      "lastIndexedBlock": 42560000,
      "activePolicies": 12,
      "pendingCharges": 1,
      "healthy": true
    },
    "747": {
      "name": "Flow EVM",
      "lastIndexedBlock": 56881090,
      "activePolicies": 5,
      "pendingCharges": 0,
      "healthy": true
    }
  },
  "webhooks": {
    "pending": 0,
    "failed": 0
  }
}
```

### Run Indexer Manually

To index events without starting the full relayer:

```bash
npm run cli -- index --chain flowEvm
```

---

## Development Workflow

### Watch Logs

Set `LOG_LEVEL=debug` for verbose output:

```bash
LOG_LEVEL=debug npm run dev
```

### Test a Manual Charge

```bash
npm run cli -- charge 0xPOLICY_ID_HERE
```

### Backfill Events

If you need to re-index from a specific block:

```bash
npm run cli -- backfill --chain flowEvm --from-block 56881090
```

### Reset Database

To start fresh:

```bash
# Stop the relayer first, then:
docker exec -it autopay-db psql -U autopay -d autopay -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Re-run migrations
npm run cli -- db:migrate
```

---

## Troubleshooting

### "Missing required environment variable"

Ensure all required vars are set in `.env`:
- `DATABASE_URL`
- `RELAYER_PRIVATE_KEY`

### "Connection refused" (PostgreSQL)

Check Docker is running:

```bash
docker ps | grep autopay-db
```

Start it if stopped:

```bash
docker start autopay-db
```

### "Insufficient funds for gas"

Your relayer wallet needs native tokens for gas. Check the startup logs for your wallet address and fund it on each enabled consolidation chain (ETH on Base, FLOW on Flow EVM).

### "Rate limited" or "Too many requests"

Some RPCs have rate limits. The relayer handles this with delays and batch sizing, but if you see issues:
- Use a private RPC endpoint
- Flow EVM uses a batch size of 9,000 blocks; Base uses 10 blocks (Alchemy free tier limit)

### Relayer Not Picking Up Events

1. Check the indexer is running: look for `INFO (indexer): Processing batch` in logs
2. Verify the contract address in config matches your deployment
3. Check `startBlock` is before your first policy was created
4. If using `MERCHANT_ADDRESSES`, verify the filter includes the merchants you expect

---

## Related Documentation

- **Configuration Reference** - All environment variables and settings
- **Deploying the Relayer** - Deploy to production
- **Relayer Operations** - CLI commands, webhooks, metadata
