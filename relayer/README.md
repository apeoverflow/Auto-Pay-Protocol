# AutoPay Relayer Service

The relayer is a backend service that indexes blockchain events, executes recurring subscription charges, and notifies merchants via webhooks.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RELAYER ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐                                                   │
│  │   Arc Testnet    │  ◄── Only enabled chain (chainId: 5042002)        │
│  └────────┬─────────┘                                                   │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                   │
│  │   Event Indexer  │  ◄── Polls every 15s, 9k block batches            │
│  │                  │      Indexes: PolicyCreated, PolicyRevoked,       │
│  │                  │               ChargeSucceeded, ChargeFailed       │
│  └────────┬─────────┘                                                   │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                   │
│  │    PostgreSQL    │  ◄── policies, charges, webhooks, indexer_state   │
│  └────────┬─────────┘                                                   │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                   │
│  │  Charge Executor │  ◄── Runs every 60s, processes due charges        │
│  │                  │      Arc gas: 1 gwei min priority fee             │
│  └────────┬─────────┘                                                   │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                   │
│  │  Webhook Sender  │  ◄── Runs every 10s, HMAC-SHA256 signed           │
│  │                  │      3 retries with exponential backoff           │
│  └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
relayer/
├── package.json                    # Project manifest
├── tsconfig.json                   # TypeScript configuration
├── .env.example                    # Environment template
├── .gitignore                      # Git ignore rules
│
├── src/
│   ├── index.ts                    # Main entry point - starts all services
│   ├── config.ts                   # Configuration loading & validation
│   ├── types.ts                    # Shared TypeScript interfaces
│   │
│   ├── abis/
│   │   └── ArcPolicyManager.json   # Contract ABI (copied from frontend)
│   │
│   ├── db/
│   │   ├── index.ts                # Database connection pool & status queries
│   │   ├── policies.ts             # Policy CRUD operations
│   │   ├── charges.ts              # Charge record operations
│   │   ├── webhooks.ts             # Webhook queue operations
│   │   ├── merchants.ts            # Merchant configuration
│   │   ├── indexer-state.ts        # Block checkpoint management
│   │   └── migrations/
│   │       ├── 001_initial_schema.sql   # Initial database schema
│   │       └── index.ts                 # Migration runner
│   │
│   ├── indexer/
│   │   ├── index.ts                # Indexer orchestration & loops
│   │   ├── poller.ts               # Chain polling with rate limiting
│   │   └── event-parser.ts         # Contract event decoding
│   │
│   ├── executor/
│   │   ├── index.ts                # Executor loop & batch processing
│   │   ├── charge.ts               # Single charge execution
│   │   ├── gas-estimator.ts        # Gas estimation with Arc minimums
│   │   └── retry.ts                # Retry logic & backoff
│   │
│   ├── webhooks/
│   │   ├── index.ts                # Webhook sender loop
│   │   ├── delivery.ts             # HTTP delivery with timeout
│   │   └── signer.ts               # HMAC-SHA256 signing
│   │
│   ├── api/
│   │   └── health.ts               # Health check HTTP server
│   │
│   └── utils/
│       └── logger.ts               # Pino structured logging
│
├── bin/
│   └── cli.ts                      # CLI entry point
│
└── docker/
    ├── docker-compose.yml          # Docker Compose for local dev
    └── Dockerfile                  # Production Docker image
```

---

## Components Breakdown

### 1. Configuration (`src/config.ts`)

Loads and validates environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `RELAYER_PRIVATE_KEY` | Yes | Wallet private key (0x...) |
| `ARC_TESTNET_RPC` | No | Arc RPC URL (defaults to public) |
| `PORT` | No | Health server port (default: 3001) |
| `LOG_LEVEL` | No | Log level (default: info) |

**Arc Testnet Configuration:**
```typescript
{
  chainId: 5042002,
  policyManagerAddress: '0xCa974B1EeC022B6E27bfA24D021F518C4d5b3734',
  startBlock: 25313040,
  pollIntervalMs: 15000,      // 15 seconds
  batchSize: 9000,            // Arc limits to 10k blocks
  confirmations: 2,
  minGasFees: {
    maxPriorityFeePerGas: 1_000_000_000n,  // 1 gwei (Arc minimum)
    maxFeePerGas: 50_000_000_000n,          // 50 gwei
  }
}
```

---

### 2. Database Layer (`src/db/`)

#### Schema (`migrations/001_initial_schema.sql`)

**policies** - Indexed from blockchain events
```sql
CREATE TABLE policies (
  id TEXT NOT NULL,                     -- policyId (bytes32 hex)
  chain_id INTEGER NOT NULL,
  payer TEXT NOT NULL,
  merchant TEXT NOT NULL,
  charge_amount TEXT NOT NULL,          -- bigint as string
  spending_cap TEXT NOT NULL,
  total_spent TEXT DEFAULT '0',
  interval_seconds INTEGER NOT NULL,
  last_charged_at TIMESTAMPTZ,
  next_charge_at TIMESTAMPTZ NOT NULL,  -- For efficient due queries
  charge_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  metadata_url TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_block BIGINT NOT NULL,
  created_tx TEXT NOT NULL,
  PRIMARY KEY (id, chain_id)
);
```

**charges** - Execution records
```sql
CREATE TABLE charges (
  id SERIAL PRIMARY KEY,
  policy_id TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, success, failed
  amount TEXT NOT NULL,
  protocol_fee TEXT,
  error_message TEXT,
  attempt_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

**webhooks** - Delivery queue
```sql
CREATE TABLE webhooks (
  id SERIAL PRIMARY KEY,
  policy_id TEXT NOT NULL,
  charge_id INTEGER,
  event_type TEXT NOT NULL,      -- charge.succeeded, charge.failed, etc.
  payload TEXT NOT NULL,         -- JSON
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  attempts INTEGER DEFAULT 0,
  next_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**merchants** - Webhook configuration
```sql
CREATE TABLE merchants (
  address TEXT PRIMARY KEY,
  webhook_url TEXT,
  webhook_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**indexer_state** - Block checkpoints
```sql
CREATE TABLE indexer_state (
  chain_id INTEGER PRIMARY KEY,
  last_indexed_block BIGINT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Key Indexes
```sql
CREATE INDEX idx_policies_next_charge ON policies(chain_id, active, next_charge_at)
  WHERE active = true;
CREATE INDEX idx_webhooks_pending ON webhooks(status, next_attempt_at)
  WHERE status = 'pending';
```

---

### 3. Event Indexer (`src/indexer/`)

**What it does:**
1. Polls Arc Testnet for new blocks
2. Fetches contract events in batches
3. Parses and stores events in database
4. Updates block checkpoint

**Events Indexed:**

| Event | Action |
|-------|--------|
| `PolicyCreated` | Insert policy, queue `policy.created` webhook |
| `PolicyRevoked` | Mark policy inactive, queue `policy.revoked` webhook |
| `ChargeSucceeded` | Update policy state (for external charges) |
| `ChargeFailed` | Log warning |

**Arc-Specific Handling:**
- Max 9,000 blocks per `getLogs` call (Arc limits to 10k)
- 300ms delay between requests (rate limiting)
- Sequential requests, not parallel

**Flow:**
```
1. Get last indexed block from DB (or start from deploy block)
2. Get latest block from chain
3. For each batch of 9k blocks:
   a. Fetch logs
   b. Parse each event
   c. Update database
   d. Update checkpoint
   e. Wait 300ms
4. Repeat on poll interval (15s)
```

---

### 4. Charge Executor (`src/executor/`)

**What it does:**
1. Queries database for due policies
2. Verifies on-chain with `canCharge()`
3. Simulates then executes `charge()`
4. Updates database and queues webhooks

**Due Policy Query:**
```sql
SELECT * FROM policies
WHERE chain_id = $1
  AND active = true
  AND next_charge_at <= NOW()
ORDER BY next_charge_at ASC
LIMIT 10;
```

**Execution Flow:**
```
1. Find due policies (batch of 10)
2. For each policy:
   a. Create charge record (status: pending)
   b. Call canCharge() on-chain
   c. If cannot charge → mark failed, queue webhook
   d. Simulate transaction
   e. Execute with Arc gas settings
   f. Wait for receipt
   g. Parse ChargeSucceeded event
   h. Update policy: last_charged_at, next_charge_at, total_spent
   i. Mark charge success, queue webhook
3. Repeat every 60s
```

**Retry Logic:**
- Max 3 attempts per charge period
- Backoff: 1min → 5min → 15min
- Retryable errors: network, timeout, nonce
- Non-retryable: reverts, business logic failures

---

### 5. Webhook Sender (`src/webhooks/`)

**Webhook Events:**

| Event | When |
|-------|------|
| `charge.succeeded` | Payment collected |
| `charge.failed` | Payment failed |
| `policy.created` | New subscription |
| `policy.revoked` | Subscription cancelled |

**Payload Format:**
```json
{
  "event": "charge.succeeded",
  "timestamp": "2026-02-05T12:00:00Z",
  "data": {
    "policyId": "0x...",
    "chainId": 5042002,
    "payer": "0x...",
    "merchant": "0x...",
    "amount": "10000000",
    "protocolFee": "250000",
    "txHash": "0x..."
  }
}
```

**Signing:**
```typescript
// Header: X-AutoPay-Signature
const signature = createHmac('sha256', merchantSecret)
  .update(JSON.stringify(payload))
  .digest('hex')
```

**Delivery:**
- 10 second timeout
- 3 retry attempts
- Exponential backoff: 1min, 5min, 15min
- Runs every 10 seconds

#### Webhook Lifecycle

The webhooks table acts as a delivery queue with automatic retry logic:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      WEBHOOK LIFECYCLE                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. EVENT OCCURS (PolicyCreated, ChargeSucceeded, etc.)                 │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────┐                                                    │
│  │  queueWebhook() │  Creates row with status='pending'                 │
│  └────────┬────────┘  attempts=0, next_attempt_at=NOW()                 │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────┐                                                    │
│  │  Sender Loop    │  Runs every 10s, queries pending webhooks          │
│  │  (10s interval) │  WHERE status='pending' AND next_attempt_at<=NOW() │
│  └────────┬────────┘                                                    │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────┐     ┌──────────────────────────────────┐           │
│  │ Delivery Attempt│────►│ HTTP POST to merchant webhook_url │           │
│  │ (10s timeout)   │     │ Headers: X-AutoPay-Signature      │           │
│  └────────┬────────┘     └──────────────────────────────────┘           │
│           │                                                              │
│     ┌─────┴─────┐                                                       │
│     │           │                                                       │
│     ▼           ▼                                                       │
│  SUCCESS     FAILURE                                                    │
│  (2xx)       (4xx/5xx/timeout)                                          │
│     │           │                                                       │
│     ▼           ▼                                                       │
│  ┌────────┐  ┌─────────────────────────────────────────┐                │
│  │ status │  │ attempts < 3?                           │                │
│  │='sent' │  │  YES: status='pending'                  │                │
│  └────────┘  │       attempts++                        │                │
│              │       next_attempt_at = NOW() + backoff │                │
│              │       (1min → 5min → 15min)             │                │
│              │  NO:  status='failed'                   │                │
│              └─────────────────────────────────────────┘                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Status Transitions:**

| From | To | Condition |
|------|----|-----------|
| (new) | `pending` | Event occurs, webhook queued |
| `pending` | `sent` | HTTP 2xx response received |
| `pending` | `pending` | Delivery failed, attempts < 3, scheduled for retry |
| `pending` | `failed` | Delivery failed, attempts >= 3, no more retries |

**Retry Backoff Schedule:**

| Attempt | Backoff | next_attempt_at |
|---------|---------|-----------------|
| 1 | 0 | Immediate |
| 2 | 1 minute | NOW() + 1 min |
| 3 | 5 minutes | NOW() + 5 min |
| 4 | (final) | Marked as `failed` |

**Key Database Operations:**

```typescript
// Queue a new webhook (src/db/webhooks.ts)
async function queueWebhook(policyId: string, chargeId: number | null,
                            eventType: string, payload: object): Promise<void>

// Get pending webhooks ready for delivery
async function getPendingWebhooks(limit: number): Promise<Webhook[]>
// Query: status='pending' AND next_attempt_at <= NOW()

// Mark as successfully sent
async function markWebhookSent(id: number): Promise<void>
// Sets: status='sent', last_attempt_at=NOW()

// Mark as failed with retry logic
async function markWebhookFailed(id: number, error: string): Promise<void>
// If attempts < 3: keeps status='pending', increments attempts, sets next_attempt_at
// If attempts >= 3: sets status='failed'
```

**Notes:**
- Webhooks are only sent if the merchant has configured a `webhook_url` in the `merchants` table
- The `merchants` table is preserved when resetting the indexer database
- Failed webhooks remain in the database for debugging/manual retry

---

### 6. Health API (`src/api/health.ts`)

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-05T12:00:00Z",
  "chains": {
    "5042002": {
      "name": "Arc Testnet",
      "lastIndexedBlock": 25315000,
      "activePolicies": 42,
      "pendingCharges": 3,
      "healthy": true
    }
  },
  "executor": {
    "healthy": true
  },
  "webhooks": {
    "pending": 2,
    "failed": 0
  }
}
```

**Status Codes:**
- `200` - healthy
- `503` - degraded (missing data, too many failed webhooks)

---

### 7. CLI (`bin/cli.ts`)

| Command | Description |
|---------|-------------|
| `relayer start` | Start all services (indexer + executor + webhooks) |
| `relayer db:migrate` | Run database migrations |
| `relayer index [--chain]` | Run indexer once |
| `relayer charge <policyId>` | Manually charge a policy |
| `relayer backfill --from-block` | Backfill events from block |
| `relayer status` | Show relayer status |

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `viem` | ^2.21.0 | Ethereum interactions |
| `postgres` | ^3.4.4 | PostgreSQL client |
| `pino` | ^9.1.0 | Structured logging |
| `pino-pretty` | ^11.2.0 | Dev log formatting |
| `commander` | ^12.1.0 | CLI framework |
| `dotenv` | ^16.4.5 | Environment variables |
| `tsx` | ^4.15.0 | TypeScript execution |
| `vitest` | ^1.6.0 | Testing |

---

## Quick Start

### 1. Install Dependencies
```bash
cd relayer
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with:
# - DATABASE_URL (postgres connection string)
# - RELAYER_PRIVATE_KEY (wallet with gas tokens)
```

### 3. Start Database (Local Dev)
```bash
docker compose -f docker/docker-compose.yml up db -d
```

### 4. Run Migrations
```bash
npm run cli -- db:migrate
```

### 5. Start Relayer
```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

---

## What's NOT Implemented Yet

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-chain support | Planned | Polygon Amoy, Arbitrum Sepolia |
| Merchant API | Planned | REST API for merchants to query data |
| Prometheus metrics | Planned | `/metrics` endpoint |
| Integration tests | Planned | End-to-end testing |
| Rate limiting | Partial | Basic delays, not adaptive |
| Reorg handling | Basic | Re-indexes last N blocks |
| Batch charging | Not started | Multiple charges in one tx |

---

## Contract Reference

**ArcPolicyManager** at `0xCa974B1EeC022B6E27bfA24D021F518C4d5b3734`

Key functions used:
- `canCharge(bytes32 policyId) → (bool, string)` - Check if chargeable
- `charge(bytes32 policyId)` - Execute charge

Events indexed:
- `PolicyCreated(bytes32 indexed policyId, address indexed payer, address indexed merchant, uint128 chargeAmount, uint32 interval, uint128 spendingCap, string metadataUrl)`
- `PolicyRevoked(bytes32 indexed policyId, address indexed payer, address indexed merchant, uint32 endTime)`
- `ChargeSucceeded(bytes32 indexed policyId, address indexed payer, address indexed merchant, uint128 amount, uint128 protocolFee)`
- `ChargeFailed(bytes32 indexed policyId, string reason)`
