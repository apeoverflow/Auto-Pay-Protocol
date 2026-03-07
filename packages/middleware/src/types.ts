import type { PublicClient } from 'viem'
import type { ChainKey } from './chains'

/** On-chain policy data returned by the PolicyManager.policies() getter */
export interface PolicyData {
  payer: `0x${string}`
  merchant: `0x${string}`
  chargeAmount: bigint
  spendingCap: bigint
  totalSpent: bigint
  interval: number
  lastCharged: number
  chargeCount: number
  consecutiveFailures: number
  endTime: number
  active: boolean
  metadataUrl: string
}

/** Result of verifying a subscription */
export type VerifyResult =
  | { ok: true; policy: PolicyData }
  | { ok: false; reason: string }

/** Options for createSubscriptionVerifier (internal — used by verify.ts) */
export interface VerifierOptions {
  /** Merchant address that policies must be assigned to */
  merchant: `0x${string}`
  /** PolicyManager contract address */
  policyManager: `0x${string}`
  /** RPC URL for on-chain reads */
  rpcUrl: string
  /** Cache TTL in milliseconds for active policies. Default: 60000 (60s) */
  cacheTtlMs?: number
  /** Optional pre-configured viem PublicClient (overrides rpcUrl) */
  client?: PublicClient
  /** Max allowed token lifetime in seconds. Tokens with expiry further than this from their creation are rejected. Default: 86400 (24 hours) */
  maxTokenAgeSeconds?: number
  /** Clock skew tolerance in seconds. Allows tokens that expired up to this many seconds ago. Default: 30 */
  clockSkewSeconds?: number
}

/** Plan info for the 402 discovery body */
export interface DiscoveryPlan {
  name: string
  amount: string
  currency?: string
  interval: number
  description?: string
  metadataUrl?: string
}

/** Network info for the 402 discovery body */
export interface DiscoveryNetwork {
  chainId: number
  name: string
  policyManager: `0x${string}`
  usdc: `0x${string}`
}

/** Options for building a 402 discovery body (internal) */
export interface DiscoveryOptions {
  merchant: `0x${string}`
  plans: DiscoveryPlan[]
  networks: DiscoveryNetwork[]
  /** Relayer URL for querying subscriptions (e.g. GET /payers/:address/policies). Agents use this to list existing subscriptions. */
  relayerUrl?: string
}

/** The full 402 response body shape */
export interface DiscoveryBody {
  error: string
  accepts: string[]
  autopay: {
    type: 'subscription'
    merchant: `0x${string}`
    plans: DiscoveryPlan[]
    networks: DiscoveryNetwork[]
    /** Relayer URL for querying subscriptions */
    relayerUrl?: string
  }
}

/** Options for requireSubscription() — the primary user-facing API */
export interface MiddlewareOptions {
  /** Your merchant address */
  merchant: `0x${string}`
  /** Chain to verify subscriptions on */
  chain: ChainKey
  /** Available subscription plans (included in 402 discovery) */
  plans: DiscoveryPlan[]
  /** Relayer URL for agents to query existing subscriptions */
  relayerUrl?: string
  /** Override the default RPC URL for this chain */
  rpcUrl?: string
  /** Cache TTL in milliseconds for active policies. Default: 60000 (60s) */
  cacheTtlMs?: number
  /** Max allowed token lifetime in seconds. Default: 86400 (24 hours) */
  maxTokenAgeSeconds?: number
  /** Clock skew tolerance in seconds. Default: 30 */
  clockSkewSeconds?: number
}
