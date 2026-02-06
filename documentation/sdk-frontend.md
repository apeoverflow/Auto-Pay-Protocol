# Frontend Integration Guide

## Overview

AutoPay provides React hooks for building subscription UIs on Arc Testnet. The frontend uses Circle Modular Wallets for passkey-based authentication and viem for contract interactions. All gas fees are sponsored via Circle's paymaster.

---

## Prerequisites

- Node.js 20+
- React 18+
- Dependencies: `viem`, `@circle-fin/modular-wallets-core`, `@circle-fin/modular-wallets-w3s`

---

## Quick Start

```typescript
import { useCreatePolicy } from '../hooks/useCreatePolicy'

function SubscribeButton() {
  const { createPolicy, isLoading, error } = useCreatePolicy()

  const handleSubscribe = async () => {
    const policyId = await createPolicy({
      merchant: '0xMERCHANT_ADDRESS' as `0x${string}`,
      chargeAmount: 10_000000n,        // 10 USDC
      interval: 30 * 24 * 60 * 60,     // 30 days
      spendingCap: 120_000000n,         // 120 USDC max
      metadataUrl: 'https://relayer.example.com/metadata/pro-plan',
    })
    console.log('Subscribed! Policy ID:', policyId)
  }

  return (
    <button onClick={handleSubscribe} disabled={isLoading}>
      {isLoading ? 'Subscribing...' : 'Subscribe - 10 USDC/month'}
    </button>
  )
}
```

> **Note:** `createPolicy` executes the first charge immediately. The user pays upfront when subscribing.

---

## Authentication (Passkey Wallet)

### AuthContext

The `AuthContext` manages passkey-based authentication using Circle Modular Wallets. It provides:

- `register(username)` -- Create a new passkey credential
- `login()` -- Authenticate with an existing passkey
- `logout()` -- Clear credentials and session
- `isAuthenticated` -- Whether a valid credential exists
- `username` -- The authenticated username

Credentials and username are persisted to `localStorage`.

### WalletContext

The `WalletContext` creates a Circle smart account from the passkey credential. It provides:

- `account` -- The `CircleSmartAccount` instance
- `address` -- The smart account address
- `balance` -- Current USDC balance
- `isWalletSetup` -- Whether USDC approval has been granted
- `setupWallet()` -- One-time wallet deployment + USDC approval
- `fetchBalance()` -- Refresh the USDC balance

---

## Wallet Setup (One-Time USDC Approval)

Before creating subscriptions, users must approve USDC spending to the PolicyManager. This is a one-time operation performed via `setupWallet()`.

### Why Unlimited Approval Is Safe

The unlimited USDC approval is safe because the PolicyManager enforces strict controls:

- Each subscription has a **spending cap** (max total that can be charged)
- Each subscription has a **charge amount** (fixed per billing cycle)
- Each subscription has an **interval** (minimum time between charges)
- Users can **revoke policies** at any time to stop future charges

The PolicyManager can only charge according to active policies -- it cannot arbitrarily drain funds.

### How Approval Works

`setupWallet()` sends a user operation that:

1. Deploys the smart account (if not already deployed)
2. Approves unlimited USDC spending to the PolicyManager contract

The wallet is considered "set up" when the USDC allowance to the PolicyManager is >= 1,000 USDC.

After setup, all future subscriptions only require a `createPolicy` call -- no additional approval prompts.

---

## Creating a Subscription

### `useCreatePolicy`

```typescript
import { useCreatePolicy } from '../hooks/useCreatePolicy'

const {
  createPolicy,    // (params: CreatePolicyParams) => Promise<`0x${string}`>
  policyId,        // Created policy ID (after success)
  hash,            // Transaction hash
  userOpHash,      // User operation hash
  status,          // Status message string
  error,           // Error message (or null)
  isLoading,       // Whether a transaction is in progress
  reset,           // Reset all state
} = useCreatePolicy()
```

### `CreatePolicyParams`

```typescript
interface CreatePolicyParams {
  merchant: `0x${string}`    // Merchant wallet address
  chargeAmount: bigint       // USDC amount per charge (6 decimals)
  interval: number           // Seconds between charges
  spendingCap: bigint        // Maximum total USDC (6 decimals)
  metadataUrl: string        // URL to plan metadata JSON
}
```

### Create Policy Example

```typescript
const policyId = await createPolicy({
  merchant: '0x742d35Cc6634C0532925a3b844Bc9e7595f2BA53e' as `0x${string}`,
  chargeAmount: 15_000000n,         // 15 USDC
  interval: 30 * 24 * 60 * 60,     // 30 days
  spendingCap: 180_000000n,         // 180 USDC (12 months)
  metadataUrl: 'https://relayer.example.com/metadata/pro-plan',
})
```

### How Create Policy Works

1. Encodes a `createPolicy` call to the ArcPolicyManager contract
2. Sends a user operation via `bundlerClient.sendUserOperation` with paymaster (gas sponsored)
3. Applies Arc-specific gas fee overrides (1 gwei `maxPriorityFeePerGas`, 50 gwei `maxFeePerGas`)
4. Waits for the user operation receipt
5. Parses the `PolicyCreated` event from transaction logs to extract the `policyId`
6. Refreshes the USDC balance (first charge is deducted on creation)

---

## Cancelling a Subscription

### `useRevokePolicy`

```typescript
import { useRevokePolicy } from '../hooks/useRevokePolicy'

const {
  revokePolicy,    // (policyId: `0x${string}`) => Promise<Hex>
  hash,            // Transaction hash
  userOpHash,      // User operation hash
  status,          // Status message string
  error,           // Error message (or null)
  isLoading,       // Whether a transaction is in progress
  reset,           // Reset all state
} = useRevokePolicy()
```

### Revoke Policy Example

```typescript
const txHash = await revokePolicy('0xPOLICY_ID_HERE' as `0x${string}`)
```

The policy is immediately inactive after revocation. Future charge attempts will fail.

---

## Reading Policy Data

### `usePolicy` (Single Policy)

Reads a single policy's on-chain state by ID. Fetches all data in parallel: policy struct, charge eligibility, next charge time, remaining allowance, and fee breakdown.

```typescript
import { usePolicy } from '../hooks/usePolicy'

const {
  policy,              // OnChainPolicy | null
  canCharge,           // boolean
  canChargeReason,     // string (reason if can't charge)
  nextChargeTime,      // Unix timestamp of next eligible charge
  remainingAllowance,  // bigint (USDC remaining under spending cap)
  chargeBreakdown,     // { total, merchantReceives, protocolFee } | null
  isLoading,
  error,
  refetch,
} = usePolicy(policyId)
```

### `usePolicies` (All User Policies)

Fetches all policies for the connected wallet. Uses a priority data source:

1. **Supabase** (indexed data) -- full history, fast queries
2. **Contract events** (fallback) -- limited to last ~9,000 blocks

```typescript
import { usePolicies } from '../hooks/usePolicies'

const {
  policies,       // OnChainPolicy[]
  isLoading,
  error,
  dataSource,     // 'supabase' | 'contract' | null
  refetch,
} = usePolicies()
```

---

## USDC Approval

### `useApproval`

Manages USDC approval for a spender address. Useful for custom approval flows.

```typescript
import { useApproval } from '../hooks/useApproval'

const {
  allowance,     // bigint (current allowance)
  isApproved,    // (amount: bigint) => boolean
  approve,       // (amount: bigint) => Promise<Hex>
  isLoading,
  status,
  error,
  reset,
} = useApproval(spenderAddress)
```

---

## Subscription Metadata

### `useMetadata`

Fetches and caches plan metadata from a `metadataUrl`. Results are cached at the module level and shared across all hook instances. Failed URLs are tracked to avoid retrying.

```typescript
import { useMetadata } from '../hooks/useMetadata'

const { metadata, isLoading } = useMetadata(policy.metadataUrl)

if (metadata) {
  console.log(metadata.plan?.name)       // "Pro Plan"
  console.log(metadata.merchant?.name)   // "Acme Inc"
  console.log(metadata.plan?.features)   // ["Unlimited usage", ...]
}
```

### `useMetadataBatch`

Batch-fetches metadata for multiple policies. Returns a map of URL to metadata.

```typescript
import { useMetadataBatch } from '../hooks/useMetadata'

const urls = policies.map(p => p.metadataUrl)
const metadataMap = useMetadataBatch(urls)

// metadataMap.get(url) => PolicyMetadata | undefined
```

### Metadata JSON Structure

```typescript
interface PolicyMetadata {
  version?: string
  plan?: {
    name?: string
    description?: string
    tier?: string
    features?: string[]
  }
  merchant?: {
    name?: string
    logo?: string
    website?: string
    supportEmail?: string
    termsUrl?: string
    privacyUrl?: string
  }
  display?: {
    color?: string
    badge?: string
    icon?: string
  }
}
```

### On-Chain vs Off-Chain Data

| Data | Source | Location |
|------|--------|----------|
| Charge amount | On-chain | `policy.chargeAmount` |
| Interval | On-chain | `policy.interval` |
| Spending cap | On-chain | `policy.spendingCap` |
| Merchant address | On-chain | `policy.merchant` |
| Plan name/description | Off-chain | `metadata.plan` |
| Merchant branding | Off-chain | `metadata.merchant` |
| Features list | Off-chain | `metadata.plan.features` |

---

## Activity Feed

### `useActivity`

Fetches the activity feed for the connected wallet: charges, subscriptions, and cancellations. Same data source priority as `usePolicies` (Supabase first, contract events fallback).

```typescript
import { useActivity } from '../hooks/useActivity'

const {
  activity,       // ActivityItem[]
  isLoading,
  error,
  dataSource,     // 'supabase' | 'contract' | null
  refetch,
} = useActivity()
```

Activity items include `type` (`charge`, `subscribe`, `cancel`), `timestamp`, `amount`, `merchant`, `txHash`, and `status`.

---

## Chain Configuration

The frontend currently supports **Arc Testnet** only. Polygon Amoy and Arbitrum Sepolia are defined but disabled pending contract deployment.

### Arc Testnet

| Property | Value |
|----------|-------|
| Chain ID | `5042002` |
| RPC URL | `https://rpc.testnet.arc.network` |
| Native Currency | USDC (6 decimals) |
| USDC Address | `0x3600000000000000000000000000000000000000` |
| ArcPolicyManager | `0x0a681aC070ef81afb1c888D3370246633aE46A27` |
| Block Explorer | `https://testnet.arcscan.app` |

### Gas Fee Overrides

Arc's bundler requires a minimum `maxPriorityFeePerGas` of 1 gwei. Circle's paymaster does not set this correctly, so all hooks that send user operations include gas overrides:

```typescript
bundlerClient.sendUserOperation({
  account,
  calls: [...],
  paymaster: true,
  maxPriorityFeePerGas: 1_000_000_000n, // 1 gwei
  maxFeePerGas: 50_000_000_000n,         // 50 gwei
})
```

These overrides are applied automatically when `chainConfig.minGasFees` is set.

---

## TypeScript Types Reference

### `OnChainPolicy`

```typescript
interface OnChainPolicy {
  policyId: `0x${string}`
  payer: `0x${string}`
  merchant: `0x${string}`
  chargeAmount: bigint         // USDC (6 decimals)
  spendingCap: bigint          // USDC (6 decimals)
  totalSpent: bigint           // USDC (6 decimals)
  interval: number             // seconds (uint32)
  lastCharged: number          // Unix timestamp (uint32)
  chargeCount: number          // successful charges (uint32)
  consecutiveFailures: number  // soft-fail count (uint8)
  endTime: number              // Unix timestamp when revoked (0 if active)
  active: boolean
  metadataUrl: string
}
```

### `PolicyChargeBreakdown`

```typescript
interface PolicyChargeBreakdown {
  total: bigint              // Full charge amount
  merchantReceives: bigint   // After protocol fee
  protocolFee: bigint        // 2.5% fee
}
```

### Contract Error Messages

The `parseContractError()` helper maps contract errors to user-friendly messages:

| Contract Error | User Message |
|---------------|--------------|
| `InsufficientAllowance` | Please approve more USDC |
| `InsufficientBalance` | Insufficient USDC balance |
| `InvalidInterval` | Interval must be 1 hour - 365 days |
| `InvalidAmount` | Invalid charge amount |
| `InvalidMerchant` | Invalid merchant address |
| `PolicyNotActive` | Subscription already cancelled |
| `NotPolicyOwner` | You can only cancel your own subscriptions |
| `SpendingCapExceeded` | Spending cap exceeded |
| `TooSoonToCharge` | Too soon to charge |

---

## Troubleshooting

### "Wallet not connected"

Ensure the user has authenticated via `AuthContext` and the `WalletContext` has created a smart account before calling any hooks.

### Arc Gas Fee Errors

If transactions fail with gas-related errors, verify that gas overrides are applied. All hooks that send user operations check for `chainConfig.minGasFees` and include the overrides automatically.

### Rate Limiting on Contract Event Queries

Arc RPC limits `eth_getLogs` to 10,000 blocks per request. The `usePolicies` and `useActivity` hooks use a 9,000 block range for safety. When Supabase is available, hooks use indexed data instead, which has no block range limitation.

### "Policy created but could not parse policyId"

This occurs when the `PolicyCreated` event is not found in the transaction receipt logs. This can happen if the contract reverted silently. Check the transaction on the [Arc Testnet Explorer](https://testnet.arcscan.app).

### Stale Policy Data

Call `refetch()` on `usePolicy`, `usePolicies`, or `useActivity` to refresh data. These hooks auto-fetch on mount but do not poll for updates.

---

## Related Documentation

- [Backend Integration Guide](./sdk-backend.md) - Webhook handling for merchants
- [Relayer Operations](./relayer-operations.md) - Metadata and merchant management
- [Configuration Reference](./relayer-configuration.md) - Relayer settings
