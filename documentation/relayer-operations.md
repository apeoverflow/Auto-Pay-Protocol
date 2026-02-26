# Relayer Operations Guide

## Overview

This guide covers day-to-day relayer operations: CLI commands, webhook management, plan metadata, logo hosting, API endpoints, and debugging. For initial setup, see the **Running Locally** or **Deployment** guides.

---

## CLI Usage

```bash
# Local development
npm run cli -- <command> [options]

# Docker
docker exec autopay-relayer npm run cli -- <command> [options]
```

---

## Core Commands

### `start`

Start the full relayer service (indexer + executor + webhooks + API).

```bash
npm run cli -- start
```

Runs continuously until stopped (`Ctrl+C`). It:
- Indexes events from all enabled chains
- Executes charges when policies are due
- Sends webhooks to merchants
- Serves the health and metadata API

### `status`

Show current relayer status.

```bash
npm run cli -- status
```

Output:

```
=== AutoPay Relayer Status ===

Base (8453):
  Last indexed block: 42560000
  Active policies: 12
  Pending charges: 1

Flow EVM (747):
  Last indexed block: 56881090
  Active policies: 42
  Pending charges: 3

Webhooks:
  Pending: 2
  Failed: 0
```

### `db:migrate`

Run database migrations. Safe to run multiple times (idempotent).

```bash
npm run cli -- db:migrate
```

Run this after first install and after updating to a new version.

---

## Indexer Commands

### `index`

Run the indexer once for a specific chain.

```bash
npm run cli -- index --chain flowEvm
```

| Option | Description | Default |
|--------|-------------|---------|
| `--chain <name>` | Chain to index | `flowEvm` |
| `--from-block <n>` | Start from specific block | Last indexed |

> **Note:** The `index` and `backfill` commands respect the `MERCHANT_ADDRESSES` filter. When set, only events for the specified merchants are processed. See the **Configuration Reference** for details.

### `backfill`

Re-index events from a specific block. Useful for recovering missed events after downtime.

```bash
npm run cli -- backfill --chain flowEvm --from-block 26573469
```

| Option | Required | Description |
|--------|----------|-------------|
| `--chain <name>` | No | Chain to backfill (default: `flowEvm`) |
| `--from-block <n>` | Yes | Block to start from |

---

## Executor Commands

### `charge`

Manually charge a specific policy.

```bash
npm run cli -- charge 0xPOLICY_ID
```

| Argument | Description |
|----------|-------------|
| `policyId` | The policy ID (bytes32 hex string) |

Output on success:

```
[cli] Manually charging policy...
[executor:charge] Charge successful
[cli] Charge successful { txHash: '0x...' }
```

Output on failure:

```
[cli] Charge failed { error: 'Policy not active' }
```

---

## Configuration Commands

### `config:retry`

View current retry configuration and available presets.

```bash
npm run cli -- config:retry
```

Output:

```
=== Retry Configuration ===

Current: standard (3 retries: 1min -> 5min -> 15min, cancel after 3 failures)

Available presets:
  aggressive: 3 retries (30s -> 1min -> 2min), cancel after 3 failures
  standard: 3 retries (1min -> 5min -> 15min), cancel after 3 failures
  conservative: 5 retries (5min -> 15min -> 30min -> 1hr -> 2hr), cancel after 5 failures

To change, set environment variables:
  RETRY_PRESET=aggressive|standard|conservative|custom
```

See the **Configuration Reference** for full details.

---

## Merchant Management

Merchants configure their own webhooks and API keys through the **merchant dashboard** (Settings → Webhooks / API Keys). The dashboard uses the relayer's self-service API endpoints. No CLI interaction needed.

For **self-hosted relayers**, the CLI is also available:

### `merchant:add`

Register a merchant's webhook configuration. Running this command again with the same address updates the existing config.

```bash
npm run cli -- merchant:add \
  --address 0xMERCHANT_ADDRESS \
  --webhook-url https://merchant.com/webhooks/autopay \
  --webhook-secret your_secret_here
```

| Option | Required | Description |
|--------|----------|-------------|
| `--address <addr>` | Yes | Merchant's wallet address |
| `--webhook-url <url>` | Yes | URL to receive webhooks |
| `--webhook-secret <secret>` | Yes | Secret for HMAC-SHA256 signing |

The webhook secret is used to sign payloads with HMAC-SHA256. Merchants verify the signature from the `X-AutoPay-Signature` header. See the **Backend Integration Guide** for verification code.

### `merchant:list`

List all registered merchants.

```bash
npm run cli -- merchant:list
```

Output:

```
=== Registered Merchants ===

Address: 0x742d35cc6634c0532925a3b844bc9e7595f...
  Webhook URL: https://acme.com/webhooks/autopay
  Webhook Secret: (configured)
  Registered: 2026-02-05T10:30:00.000Z
```

---

## Plan Metadata

Plan metadata customizes how subscriptions appear in the checkout UI. It contains display information (plan name, features, merchant branding) while billing details live on-chain.

### Metadata JSON Format

```json
{
  "version": "1.0",
  "plan": {
    "name": "Pro Plan",
    "description": "Premium subscription with all features",
    "tier": "pro",
    "features": [
      "Unlimited API calls",
      "Priority support",
      "Advanced analytics"
    ]
  },
  "merchant": {
    "name": "Acme Corporation",
    "logo": "acme-logo.png",
    "website": "https://acme.com",
    "supportEmail": "support@acme.com",
    "termsUrl": "https://acme.com/terms",
    "privacyUrl": "https://acme.com/privacy"
  },
  "display": {
    "color": "#6366f1",
    "badge": "Popular"
  }
}
```

### Field Reference

#### `plan`

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name shown to users |
| `description` | string | Brief description of what's included |
| `tier` | string | Plan tier: `free`, `starter`, `pro`, `enterprise` |
| `features` | string[] | List of features included in this plan |

#### `merchant`

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Your company/product name |
| `logo` | string | Logo filename (from upload API) or full URL |
| `website` | string | Your website URL |
| `supportEmail` | string | Customer support email |
| `termsUrl` | string | Link to terms of service |
| `privacyUrl` | string | Link to privacy policy |

#### `display` (optional)

| Field | Type | Description |
|-------|------|-------------|
| `color` | string | Brand color (hex) for UI styling |
| `badge` | string | Badge text (e.g., "Most Popular", "Best Value") |

### `metadata:add`

Register or update plan metadata from a JSON file.

```bash
npm run cli -- metadata:add \
  --id pro-plan \
  --merchant 0xMERCHANT_ADDRESS \
  --file ./plan-metadata.json
```

| Option | Required | Description |
|--------|----------|-------------|
| `--id <id>` | Yes | Unique identifier (used in URL: `/metadata/{merchant}/{id}`) |
| `--merchant <addr>` | Yes | Merchant's wallet address |
| `--file <path>` | Yes | Path to JSON metadata file |

### `metadata:list`

List all registered plan metadata.

```bash
npm run cli -- metadata:list
```

Output:

```
=== Plan Metadata ===

ID: pro-plan
  Merchant: 0x742d35Cc6634C0532925a3b844Bc9e7595f2BA53e...
  Plan: Pro Plan
  Status: active
  URL: /metadata/0x742d35Cc6634C0532925a3b844Bc9e7595f2BA53e/acme-pro
  IPFS CID: bafy...
  Created: 2026-02-05T10:30:00.000Z
```

### `metadata:get`

Get specific plan metadata by ID.

```bash
npm run cli -- metadata:get pro-plan
```

### `metadata:delete`

Delete plan metadata.

```bash
npm run cli -- metadata:delete pro-plan
```

---

## Logo Storage

The relayer supports merchant logo uploads via the API. Logos are stored in S3-compatible storage (Supabase Storage or equivalent) and served via public URLs.

### Configuration

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to enable logo uploads. Without these, the relayer starts but logo uploads return an error.

### Uploading Logos

Upload via the API (requires auth when `AUTH_ENABLED=true`):

```bash
curl -X POST https://relayer.autopayprotocol.com/logos \
  -H "Content-Type: image/png" \
  -H "X-Address: 0xYOUR_ADDRESS" \
  -H "X-Signature: ..." \
  -H "X-Nonce: ..." \
  --data-binary @acme-logo.png
```

The upload endpoint compresses and resizes images to 512x512 WebP (quality 80). Response:

```json
{ "filename": "a1b2c3d4-...-.webp" }
```

Reference the returned filename in plan metadata:

```json
{
  "merchant": {
    "logo": "a1b2c3d4-...-.webp"
  }
}
```

### Supported Upload Formats

| Format | Content-Type |
|--------|-------------|
| PNG | `image/png` |
| JPEG | `image/jpeg` |
| GIF | `image/gif` |
| WebP | `image/webp` |

All uploads are converted to WebP. Max upload size: 512KB.

---

## API Endpoints

The relayer exposes these HTTP endpoints (default port 3001):

### Public Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service info and available endpoints |
| `/health` | GET | Health check with chain and webhook status |
| `/auth/nonce?address=0x...` | GET | Request a nonce for EIP-191 signature auth |
| `/metadata` | GET | List all active plan metadata |
| `/metadata/:merchant/:id` | GET | Get specific plan metadata (merchant-scoped) |
| `/metadata/:id` | GET | Legacy redirect (returns first match) |
| `/logos/:filename` | GET | Serve merchant logo images |

### Authenticated Endpoints (Signature or API Key)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/merchants/:address/plans` | GET | List merchant's plans (filter by status) |
| `/merchants/:address/plans` | POST | Create a new plan (status: draft) |
| `/merchants/:address/plans/:id` | PUT/PATCH | Update plan details |
| `/merchants/:address/plans/:id` | DELETE | Delete a plan |
| `/merchants/:address/stats` | GET | Merchant statistics (revenue, subscribers, charges) |
| `/merchants/:address/charges` | GET | Paginated charge history |
| `/merchants/:address/subscribers` | GET | Paginated subscriber list (filter by plan, status) |
| `/merchants/:address/reports` | GET | List monthly reports |
| `/merchants/:address/reports/:period` | GET | Get report detail for a period |
| `/merchants/:address/reports/:period/csv` | GET | Download report as CSV |
| `/merchants/:address/reports/generate` | POST | Generate on-demand report |
| `/merchants/:address/receipts/upload` | POST | Batch upload charge receipts to IPFS |
| `/merchants/:address/webhook` | GET/PUT/DELETE | Get, configure, or delete webhook |
| `/merchants/:address/webhook/rotate-secret` | POST | Rotate webhook signing secret |
| `/merchants/:address/api-keys` | GET/POST | List or create API keys |
| `/merchants/:address/api-keys/:id` | DELETE | Revoke an API key |
| `/logos` | POST | Upload a merchant logo image |
| `/subscribers` | POST | Submit subscriber form data (checkout integration) |
| `/payers/:address/receipts/upload` | POST | Payer-initiated receipt upload to IPFS |

**Authentication:** Authenticated endpoints require one of:
- **EIP-191 signature headers**: `X-Address`, `X-Nonce`, `X-Signature` (sign a nonce from `/auth/nonce`)
- **API key header**: `X-API-Key: sk_live_...` (created via `/merchants/:address/api-keys`)

**Rate limiting:** All endpoints are rate-limited. Authenticated endpoints allow higher limits.

All endpoints return JSON and include CORS headers (`Access-Control-Allow-Origin: *`).

### Health Check Response

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
      "lastIndexedBlock": 56900000,
      "activePolicies": 42,
      "pendingCharges": 3,
      "healthy": true
    }
  },
  "executor": { "healthy": true },
  "webhooks": {
    "pending": 2,
    "failed": 0
  }
}
```

| Status Code | Meaning |
|-------------|---------|
| `200` | Healthy |
| `503` | Degraded (indexer not started or >10 failed webhooks) |

---

## Webhook Delivery Details

When events occur (charges, policy changes), the relayer sends webhooks to registered merchants.

### HMAC Signing

Every webhook is signed with the merchant's webhook secret using HMAC-SHA256:

- Header: `X-AutoPay-Signature` contains the hex-encoded HMAC
- Header: `X-AutoPay-Timestamp` contains the ISO 8601 timestamp

### Delivery Settings

| Setting | Value |
|---------|-------|
| HTTP timeout | 10 seconds |
| Max attempts | 3 |
| Expected response | Any 2xx status code |

Non-2xx responses or timeouts are treated as failures and retried.

---

## Monitoring and Debugging

### Health Check

```bash
# Local
curl http://localhost:3001/health

# Production
curl https://YOUR-URL/health
```

### Log Levels

Set `LOG_LEVEL` to control verbosity:

| Level | Description |
|-------|-------------|
| `debug` | All messages including per-block indexing details |
| `info` | Normal operation: startup, charges, webhooks |
| `warn` | Non-fatal issues: rate limits, retries |
| `error` | Failures: charge errors, DB connection issues |

### Useful Database Queries

```bash
# View recent policies
docker exec -it autopay-db psql -U autopay -d autopay \
  -c "SELECT id, payer, merchant, active, created_at FROM policies ORDER BY created_at DESC LIMIT 5;"

# Check pending charges
docker exec -it autopay-db psql -U autopay -d autopay \
  -c "SELECT id, policy_id, status, attempt_count FROM charges WHERE status = 'pending';"

# View pending webhooks
docker exec -it autopay-db psql -U autopay -d autopay \
  -c "SELECT id, event_type, status, attempts FROM webhooks WHERE status = 'pending';"

# Check failed webhooks
docker exec -it autopay-db psql -U autopay -d autopay \
  -c "SELECT id, event_type, attempts, last_attempt_at FROM webhooks WHERE status = 'failed';"
```

### Recovery After Downtime

```bash
# 1. Check how far behind
npm run cli -- status

# 2. Backfill if needed
npm run cli -- backfill --chain flowEvm --from-block LAST_KNOWN_BLOCK

# 3. Start relayer
npm run cli -- start
```

---

## Merchant Onboarding

### Self-Service (Dashboard)

Merchants onboard themselves entirely through the dashboard. No relayer operator interaction needed:

1. Connect wallet → switch to **Merchant** mode
2. Create plans via the **Plan Editor** (3-step wizard)
3. Publish plans → metadata uploaded to IPFS automatically
4. Configure webhooks in **Settings → Webhooks** (sign with wallet)
5. Create API keys in **Settings → API Keys** for programmatic access

### CLI Setup (Self-Hosted Relayers)

For self-hosted relayers, use the CLI to register merchants:

```bash
# 1. Register the merchant's webhook
npm run cli -- merchant:add \
  --address 0x742d35Cc6634C0532925a3b844Bc9e7595f2BA53e \
  --webhook-url https://acme.com/webhooks/autopay \
  --webhook-secret whsec_abc123

# 2. Create a metadata JSON file
cat > acme-pro.json << 'EOF'
{
  "version": "1.0",
  "plan": {
    "name": "Pro Plan",
    "description": "Everything you need",
    "features": ["Unlimited usage", "Priority support"]
  },
  "merchant": {
    "name": "Acme Inc",
    "logo": "acme-logo.png",
    "website": "https://acme.com"
  }
}
EOF

# 3. Register the metadata
npm run cli -- metadata:add \
  --id acme-pro \
  --merchant 0x742d35Cc6634C0532925a3b844Bc9e7595f2BA53e \
  --file acme-pro.json

# 4. Upload the logo (requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY configured)
curl -X POST http://localhost:3001/logos \
  -H "Content-Type: image/png" \
  --data-binary @acme-logo.png

# 5. Verify everything works
curl http://localhost:3001/metadata/0x742d35Cc6634C0532925a3b844Bc9e7595f2BA53e/acme-pro
curl http://localhost:3001/logos/acme-logo.png -o /dev/null -w "%{http_code}\n"
npm run cli -- merchant:list
```

---

## Troubleshooting

### Webhooks Not Delivering

1. Check merchant is registered: `npm run cli -- merchant:list`
2. Check for pending/failed webhooks in the database
3. Verify the webhook URL is reachable from the relayer
4. Check logs for delivery errors: `LOG_LEVEL=debug npm run dev`

### Metadata Not Showing

1. Verify metadata was added: `npm run cli -- metadata:list`
2. Test the API endpoint: `curl http://localhost:3001/metadata/<id>`
3. Check the metadata JSON is valid

### Logo Not Loading

1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
2. Check the Supabase Storage bucket `logos` exists and is public
3. Verify filename matches what's in metadata (case-sensitive)
4. Only alphanumeric characters, dots, hyphens, and underscores are allowed in filenames

---

## Related Documentation

- **Configuration Reference** - All environment variables and settings
- **Running Locally** - Development setup
- **Deploying the Relayer** - Production deployment
- **Backend Integration Guide** - Webhook handling for merchants
