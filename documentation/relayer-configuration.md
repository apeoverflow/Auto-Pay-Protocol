# Relayer Configuration Reference

## Overview

The AutoPay relayer is configured entirely through environment variables. This reference covers every configuration option, retry presets, merchant filtering, and the TypeScript interfaces that define the config shape.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `RELAYER_PRIVATE_KEY` | Yes | - | Wallet private key (must start with `0x`) |
| `FLOW_EVM_RPC` | No | `https://mainnet.evm.nodes.onflow.org` | Flow EVM Mainnet RPC URL |
| `PORT` | No | `3001` | API server port |
| `LOG_LEVEL` | No | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `RETRY_PRESET` | No | `standard` | Retry preset: `aggressive`, `standard`, `conservative`, `custom` |
| `RETRY_MAX_RETRIES` | No | `3` | Custom: max retries per charge period |
| `RETRY_BACKOFF_MS` | No | `60000,300000,900000` | Custom: comma-separated backoff delays (ms) |
| `RETRY_MAX_CONSECUTIVE_FAILURES` | No | `3` | Custom: consecutive soft-fails before on-chain cancel |
| `MERCHANT_ADDRESSES` | No | - | Comma-separated merchant addresses to filter by |
| `SUPABASE_URL` | No | - | Supabase project URL (required for logo uploads) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | - | Supabase service role key (required for logo uploads) |
| `STORACHA_PRINCIPAL_KEY` | No | - | Ed25519 DID key for Storacha (IPFS + Filecoin) |
| `STORACHA_DELEGATION_PROOF` | No | - | Base64-encoded delegation CAR for Storacha |
| `IPFS_GATEWAY` | No | `https://w3s.link` | IPFS gateway for resolving CIDs |
| `AUTH_ENABLED` | No | `false` | Enable EIP-191 signature auth for plan management |

---

## Annotated .env.example

```bash
# Database (any Postgres - Supabase, Neon, Docker, local)
DATABASE_URL=postgres://autopay:password@localhost:5432/autopay

# Relayer wallet private key (must have native tokens for gas)
RELAYER_PRIVATE_KEY=0x...

# RPC URLs (Flow EVM is the current consolidation chain)
FLOW_EVM_RPC=https://mainnet.evm.nodes.onflow.org

# Future consolidation chains (disabled)
# BASE_RPC=https://mainnet.base.org
# POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology

# Optional: Health server port
PORT=3001

# Optional: Log level (debug, info, warn, error)
LOG_LEVEL=info

# Optional: Retry configuration
# Presets: aggressive (30s,1m,2m), standard (1m,5m,15m), conservative (5m,15m,30m,1h,2h), custom
RETRY_PRESET=standard

# Custom retry settings (only used when RETRY_PRESET=custom)
# RETRY_MAX_RETRIES=3
# RETRY_BACKOFF_MS=60000,300000,900000
# RETRY_MAX_CONSECUTIVE_FAILURES=3

# Optional: Only process policies for specific merchants (comma-separated)
# When unset/empty, all merchants are processed (default)
# MERCHANT_ADDRESSES=0xabc...,0xdef...

# Optional: Logo storage (S3-compatible — Supabase Storage or equivalent)
# Required for logo uploads. Without these, the relayer starts but logos are disabled.
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

# Optional: Storacha (IPFS + Filecoin) for immutable plan metadata
# When configured, plan activation uploads metadata to IPFS (blocking).
# Without these, plans activate without IPFS CID (self-hosted fallback).
# STORACHA_PRINCIPAL_KEY=...
# STORACHA_DELEGATION_PROOF=...
# IPFS_GATEWAY=https://w3s.link

# Optional: Enable EIP-191 signature auth for plan management
# AUTH_ENABLED=true
```

---

## Chain Configuration

A **consolidation chain** is any EVM chain where a PolicyManager contract is deployed and subscriptions settle. The relayer supports multiple consolidation chains simultaneously — each with its own config entry in `CHAIN_CONFIGS`.

Currently enabled: **Flow EVM Mainnet**. Base is planned as the future default.

### Flow EVM Mainnet

| Property | Value |
|----------|-------|
| Chain ID | `747` |
| RPC URL | `https://mainnet.evm.nodes.onflow.org` |
| PolicyManager | `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345` |
| USDC | `0xF1815bd50389c46847f0Bda824eC8da914045D14` |
| Start Block | `56881090` |
| Poll Interval | 15 seconds |
| Batch Size | 9,000 blocks |
| Confirmations | 2 blocks |

### Arc Testnet (legacy)

| Property | Value |
|----------|-------|
| Chain ID | `5042002` |
| RPC URL | `https://rpc.testnet.arc.network` |
| PolicyManager | `0xe3463a10Cb69D9705A38cECac3cBC58AD76f5De1` |
| USDC | `0x3600000000000000000000000000000000000000` |
| Start Block | `26573469` |

> Arc Testnet is not currently enabled in the relayer config but the deployment metadata is retained for reference.

---

## Database Configuration

The relayer accepts a standard PostgreSQL connection string via `DATABASE_URL`. It works with any Postgres provider.

| Provider | Example Connection String |
|----------|--------------------------|
| Docker (local) | `postgres://autopay:password@localhost:5432/autopay` |
| Supabase | `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres` |
| Neon | `postgres://user:pass@ep-cool-rain.neon.tech/neondb` |
| Railway | Auto-injected as `DATABASE_URL` |

> **Note:** When using Supabase, use the **Transaction pooler** connection string (port `6543`) for best performance.

---

## Retry Configuration

The relayer supports configurable retry behavior for failed charges. Retry logic has two layers:

1. **Hard failures** (RPC errors, timeouts): retried within a single charge period using the backoff sequence.
2. **Soft failures** (insufficient balance/allowance): tracked on-chain via `consecutiveFailures`. After reaching the threshold, the relayer calls `cancelFailedPolicy()` on-chain.

### Presets

| Preset | Max Retries | Backoff Sequence | Cancel After |
|--------|-------------|------------------|--------------|
| `aggressive` | 3 | 30s, 1min, 2min | 3 consecutive failures |
| `standard` | 3 | 1min, 5min, 15min | 3 consecutive failures |
| `conservative` | 5 | 5min, 15min, 30min, 1hr, 2hr | 5 consecutive failures |
| `custom` | user-defined | user-defined | user-defined |

### Using a Preset

```bash
RETRY_PRESET=aggressive
```

### Custom Configuration

Set `RETRY_PRESET=custom` and define each value:

```bash
RETRY_PRESET=custom
RETRY_MAX_RETRIES=5
RETRY_BACKOFF_MS=10000,30000,60000,120000,300000
RETRY_MAX_CONSECUTIVE_FAILURES=4
```

### View Current Configuration

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
```

---

## Merchant Filtering

The `MERCHANT_ADDRESSES` environment variable restricts the relayer to only process policies for specified merchants. When unset or empty, all merchants are processed.

### Configuration

```bash
# Only process policies for these merchants
MERCHANT_ADDRESSES=0x742d35cc6634c0532925a3b844bc9e7595f2db4e,0x8ba1f109551bd432803012645ac136ddd64dba72
```

### How It Works

The filter is applied at two levels:

1. **Indexer**: Events for non-matching merchants are skipped during indexing. `PolicyCreated`, `PolicyRevoked`, `ChargeSucceeded`, and `PolicyCancelledByFailure` events are filtered by merchant address. `ChargeFailed` events (which lack a merchant field) are always processed.
2. **Executor**: The SQL query for due charges includes a `WHERE merchant IN (...)` clause.

### When to Use

| Scenario | Setting |
|----------|---------|
| Shared/demo relayer (process all merchants) | Leave unset (default) |
| Dedicated merchant relayer (self-hosted) | Set to merchant's address |
| Multi-merchant relayer (subset) | Comma-separated list |

### Startup Logging

```
# Filter active
INFO (relayer): Merchant filter ACTIVE - only processing listed merchants {"merchants":["0x742d..."],"count":1}

# No filter
INFO (relayer): Merchant filter INACTIVE - processing all merchants
```

### Validation

Invalid addresses cause an immediate startup error:

```
Error: Invalid merchant address in MERCHANT_ADDRESSES: not-an-address
```

---

## Indexer Settings

These are hardcoded defaults in the relayer config (not configurable via env vars):

| Setting | Value | Description |
|---------|-------|-------------|
| `pollIntervalMs` | `15000` | How often to poll for new events (15s) |
| `batchSize` | `9000` | Max blocks per `eth_getLogs` request |
| `confirmations` | `2` | Blocks to wait before considering events final |

---

## Executor Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `runIntervalMs` | `60000` | How often the executor checks for due charges (1 min) |
| `batchSize` | `10` | Max policies to charge per executor run |

---

## Webhook Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `timeoutMs` | `10000` | HTTP timeout for webhook delivery (10s) |
| `maxRetries` | `3` | Max delivery attempts per webhook |

---

## TypeScript Interfaces

These types define the config shape used throughout the relayer codebase.

```typescript
interface RelayerConfig {
  chains: Record<string, ChainConfig>
  privateKey: `0x${string}`
  databaseUrl: string
  indexer: {
    pollIntervalMs: number
    batchSize: number
    confirmations: number
  }
  executor: {
    runIntervalMs: number
    batchSize: number
  }
  retry: RetryConfig
  webhooks: {
    timeoutMs: number
    maxRetries: number
  }
  merchantAddresses: Set<string> | null // null = process all merchants
  port: number
  logLevel: string
}

interface ChainConfig {
  chainId: number
  name: string
  rpcUrl: string
  policyManagerAddress: `0x${string}`
  startBlock: number
  pollIntervalMs: number
  batchSize: number
  confirmations: number
  enabled: boolean
  minGasFees?: {
    maxPriorityFeePerGas: bigint
    maxFeePerGas: bigint
  }
}

type RetryPreset = 'aggressive' | 'standard' | 'conservative' | 'custom'

interface RetryConfig {
  preset: RetryPreset
  maxRetries: number
  backoffMs: number[]
  maxConsecutiveFailures: number
}
```

---

## Related Documentation

- [Running the Relayer Locally](./relayer-local-setup.md)
- [Deploying the Relayer](./relayer-deployment.md)
- [Relayer Operations](./relayer-operations.md)
