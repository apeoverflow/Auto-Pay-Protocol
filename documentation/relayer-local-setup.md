# Running the Relayer Locally

## Overview

This guide walks you through setting up and running the AutoPay relayer on your local machine for development and testing. The relayer indexes policy events from Arc Testnet, executes charges when subscriptions are due, and sends webhooks to merchants.

---

## Prerequisites

- **Node.js** 20+
- **Docker** (for PostgreSQL) or a managed Postgres instance
- **A funded wallet** with native tokens for gas (Arc Testnet)

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

# Optional
ARC_TESTNET_RPC=https://rpc.testnet.arc.network
PORT=3001
LOG_LEVEL=info
RETRY_PRESET=standard
```

See the [Configuration Reference](./relayer-configuration.md) for all available options.

### 4. Fund Your Relayer Wallet

The relayer wallet pays gas for `charge()` transactions. Fund it with native tokens from the Arc Testnet faucet.

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

Arc Testnet (5042002):
  Last indexed block: 25315000
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
    "5042002": {
      "name": "Arc Testnet",
      "lastIndexedBlock": 25315000,
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
npm run cli -- index --chain arcTestnet
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
npm run cli -- backfill --chain arcTestnet --from-block 26573469
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

Your relayer wallet needs native tokens. Check the startup logs for your wallet address and fund it from the Arc Testnet faucet.

### "Rate limited" or "Too many requests"

Arc RPC has rate limits. The relayer handles this with delays and batch sizing, but if you see issues:
- Use a private RPC endpoint
- The default batch size of 9,000 blocks stays within Arc's 10k limit

### Relayer Not Picking Up Events

1. Check the indexer is running: look for `INFO (indexer): Processing batch` in logs
2. Verify the contract address in config matches your deployment
3. Check `startBlock` is before your first policy was created
4. If using `MERCHANT_ADDRESSES`, verify the filter includes the merchants you expect

---

## Related Documentation

- [Configuration Reference](./relayer-configuration.md) - All environment variables and settings
- [Deploying the Relayer](./relayer-deployment.md) - Deploy to production
- [Relayer Operations](./relayer-operations.md) - CLI commands, webhooks, metadata
