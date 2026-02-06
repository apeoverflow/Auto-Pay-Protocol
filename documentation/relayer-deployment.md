# Deploying the Relayer

## Overview

This guide covers deploying the AutoPay relayer to production. Three deployment options are available: Railway (recommended for simplicity), Docker Compose (self-hosted), or a managed Postgres with a direct Node.js process.

---

## Option A: Railway (Recommended)

Railway provides the simplest deployment path with managed infrastructure, auto-deploys from GitHub, and built-in PostgreSQL.

### Step 1: Create Railway Account

Sign up at [railway.app](https://railway.app) (GitHub login recommended).

### Step 2: Create New Project

1. Click **New Project**
2. Select **Deploy from GitHub repo**
3. Select your Auto-Pay-Protocol repository

### Step 3: Configure Root Directory

1. Go to your service > **Settings**
2. Scroll to **Root Directory**
3. Set it to `relayer`
4. Click **Save**

### Step 4: Set Up Database

**Option A: Supabase (recommended if you already use it)**

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project > **Project Settings** > **Database**
3. Copy the **Transaction pooler** connection string (port `6543`)

**Option B: Railway PostgreSQL**

1. In your Railway project, click **New** > **Database** > **Add PostgreSQL**
2. Railway auto-creates and links `DATABASE_URL` to your service

### Step 5: Set Environment Variables

Go to your relayer service > **Variables** tab > **New Variable**:

| Variable | Value |
|----------|-------|
| `RELAYER_PRIVATE_KEY` | `0xYOUR_PRIVATE_KEY_HERE` |
| `ARC_TESTNET_RPC` | `https://rpc.testnet.arc.network` |
| `PORT` | `3001` |
| `LOG_LEVEL` | `info` |
| `RETRY_PRESET` | `standard` |
| `MERCHANT_ADDRESSES` | *(optional)* Comma-separated merchant addresses |

If using Supabase, also add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres` |

> **Note:** If using Railway PostgreSQL, `DATABASE_URL` is auto-injected.

See the [Configuration Reference](./relayer-configuration.md) for all available options.

### Step 6: Deploy

Railway auto-deploys when you add/change environment variables or push to main. Check the **Deployments** tab for build logs:

```
INFO (relayer): Starting AutoPay relayer...
INFO (relayer): Relayer wallet {"wallet":"0x..."}
INFO (indexer): Starting indexer loop
INFO (executor): Starting executor loop
INFO (api): API server listening on port 3001
```

### Step 7: Get Your Service URL

1. Go to your relayer service > **Settings**
2. Scroll to **Networking** > **Public Networking**
3. Click **Generate Domain**
4. You'll get a URL like: `autopay-relayer-production.up.railway.app`

### Step 8: Verify Deployment

```bash
curl https://YOUR-RAILWAY-URL.up.railway.app/health
```

### Step 9: Fund Relayer Wallet

Check deployment logs for your wallet address and fund from the Arc Testnet faucet.

### Step 10: Run CLI Commands

Railway provides a shell for running commands:

1. Go to your relayer service
2. Click the **Shell** tab (or press `Cmd/Ctrl + K` > "Open Shell")

```bash
npm run cli -- status
npm run cli -- merchant:add \
  --address 0xMERCHANT_ADDRESS \
  --webhook-url https://merchant.com/webhooks/autopay \
  --webhook-secret their_secret_here
```

For metadata files in Railway shell:

```bash
cat > /tmp/plan.json << 'EOF'
{
  "version": "1.0",
  "plan": { "name": "Pro Plan", "description": "Premium features" },
  "merchant": { "name": "Acme Inc", "logo": "acme-logo.png" }
}
EOF

npm run cli -- metadata:add \
  --id pro-plan \
  --merchant 0xMERCHANT_ADDRESS \
  --file /tmp/plan.json
```

---

## Option B: Docker Compose (Self-Hosted)

Use the included Docker Compose configuration to run the relayer alongside PostgreSQL.

### Setup

1. Create a `.env` file in the `relayer/` directory (see [Configuration Reference](./relayer-configuration.md))

2. Start the services:

```bash
cd relayer/docker
docker compose up -d
```

The `docker-compose.yml` included in `relayer/docker/`:

```yaml
services:
  relayer:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    environment:
      DATABASE_URL: postgres://autopay:password@db:5432/autopay
      RELAYER_PRIVATE_KEY: ${RELAYER_PRIVATE_KEY}
      ARC_TESTNET_RPC: ${ARC_TESTNET_RPC:-https://rpc.testnet.arc.network}
      PORT: ${PORT:-3001}
      LOG_LEVEL: ${LOG_LEVEL:-info}
      RETRY_PRESET: ${RETRY_PRESET:-standard}
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "3001:3001"
    volumes:
      - ./logos:/app/logos
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: autopay
      POSTGRES_USER: autopay
      POSTGRES_PASSWORD: password
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U autopay -d autopay"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

3. Run migrations:

```bash
docker exec autopay-relayer npm run cli -- db:migrate
```

4. Verify:

```bash
curl http://localhost:3001/health
```

### CLI Access (Docker)

```bash
docker exec autopay-relayer npm run cli -- <command>
```

---

## Option C: Managed Postgres + Direct Run

If you prefer to run the Node.js process directly (e.g., on a VPS) with a managed database:

```bash
cd relayer
npm install
npm run build

# Set environment
export DATABASE_URL=postgres://user:pass@your-provider.com:5432/autopay
export RELAYER_PRIVATE_KEY=0x...
export ARC_TESTNET_RPC=https://rpc.testnet.arc.network

# Run migrations and start
npm run cli -- db:migrate
npm start
```

Use a process manager like `pm2` or `systemd` to keep it running.

---

## Production Checklist

- [ ] PostgreSQL set up with backups (Supabase, Neon, RDS, or self-hosted)
- [ ] `RELAYER_PRIVATE_KEY` stored securely (not in plain text env files)
- [ ] Private/dedicated RPC endpoint configured
- [ ] Relayer wallet funded with native tokens for gas
- [ ] Auto-restart on failure (`restart: unless-stopped` in Docker, or `pm2`/`systemd`)
- [ ] Health monitoring configured (see below)
- [ ] Log aggregation set up for debugging
- [ ] Database migrations applied (`npm run cli -- db:migrate`)

---

## Monitoring

### Health Endpoint

The relayer exposes `GET /health` which returns:

- `200` when healthy
- `503` when degraded (indexer not started, or >10 failed webhooks)

### External Monitoring

Set up uptime checks with:
- [UptimeRobot](https://uptimerobot.com) (free)
- [Betterstack](https://betterstack.com)

Monitor: `GET https://YOUR-URL/health` and alert on non-200 responses.

### Logs

- **Railway**: Service > **Logs** tab for live streaming
- **Docker**: `docker logs -f autopay-relayer`
- **Direct**: stdout/stderr (pipe to a log file or aggregation service)

---

## Custom Domain (Optional)

**Railway:**

1. Go to service **Settings** > **Networking**
2. Click **Custom Domain**
3. Add your domain (e.g., `relayer.yourdomain.com`)
4. Add the CNAME record to your DNS

---

## Cost Breakdown

| Component | Cost |
|-----------|------|
| Railway relayer service (always-on) | ~$5-15/mo |
| Railway PostgreSQL (500MB free, then $5/mo) | $0-5/mo |
| **-- OR --** | |
| Supabase PostgreSQL (500MB free tier) | $0/mo |
| Supabase Pro (if needed) | $25/mo |
| **Total** | **$5-20/mo** |

Railway offers $5 free credit monthly on the hobby plan. Supabase free tier is generous for low-volume usage.

---

## Updating

**Railway:** Auto-deploys on push to main. To manually redeploy: **Deployments** tab > **Deploy** > **Deploy Latest Commit**.

**Docker Compose:**

```bash
cd relayer/docker
docker compose down
docker compose build
docker compose up -d
```

**Direct run:**

```bash
git pull
cd relayer
npm install
npm run build
npm run cli -- db:migrate
npm start
```

---

## Troubleshooting

### Build Fails (Railway)

- Check that root directory is set to `relayer`
- Check build logs for npm errors

### Service Crashes on Start

- Verify `RELAYER_PRIVATE_KEY` is set correctly (must start with `0x`)
- Verify `DATABASE_URL` is set and reachable

### "Connection refused" to Database

**Railway PostgreSQL:** Ensure the PostgreSQL service is in the same project and `DATABASE_URL` is auto-linked.

**Supabase:** Use the Transaction pooler connection string (port `6543`), not the direct connection (port `5432`). Verify your Supabase project is not paused (free tier pauses after inactivity).

### Relayer Not Indexing

- Check logs for indexer errors
- Verify `ARC_TESTNET_RPC` is correct and reachable
- Ensure relayer wallet has gas tokens

---

## Related Documentation

- [Configuration Reference](./relayer-configuration.md) - All environment variables and settings
- [Running Locally](./relayer-local-setup.md) - Development environment
- [Relayer Operations](./relayer-operations.md) - CLI commands, webhooks, metadata
