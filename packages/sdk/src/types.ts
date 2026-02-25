// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export type IntervalPreset = 'seconds' | 'minutes' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

export interface CheckoutOptions {
  /** Merchant wallet address (0x-prefixed, 40 hex chars) */
  merchant: string
  /** Charge amount in human-readable USDC (e.g. 9.99) */
  amount: number
  /** Billing interval — preset string, or seconds */
  interval: IntervalPreset | number
  /** URL to plan metadata JSON */
  metadataUrl: string
  /** Redirect URL on successful subscription */
  successUrl: string
  /** Redirect URL on cancel */
  cancelUrl: string
  /** Optional spending cap in human-readable USDC. Omit for unlimited. */
  spendingCap?: number
  /** Optional IPFS metadata URL — used as fallback if metadataUrl is unreachable */
  ipfsMetadataUrl?: string
  /**
   * Consolidation chain to target. Determines which subdomain the checkout URL points to.
   * Defaults to 'base' (autopayprotocol.com).
   * @example 'flowEvm' → flow.autopayprotocol.com, 'base' → autopayprotocol.com
   */
  chain?: import('./constants').ChainKey
  /** Optional base URL override — takes precedence over `chain` if both are set */
  baseUrl?: string
}

export interface SuccessRedirect {
  policyId: string
  txHash: string
}

// ---------------------------------------------------------------------------
// Webhooks — discriminated union on `type`
// ---------------------------------------------------------------------------

export type WebhookEventType =
  | 'charge.succeeded'
  | 'charge.failed'
  | 'policy.created'
  | 'policy.revoked'
  | 'policy.cancelled_by_failure'
  | 'policy.completed'

interface WebhookBase {
  timestamp: string
  data: {
    policyId: string
    chainId: number
    payer: string
    merchant: string
  }
}

export interface ChargeSucceededEvent extends WebhookBase {
  type: 'charge.succeeded'
  data: WebhookBase['data'] & {
    amount: string
    protocolFee: string
    txHash: string
  }
}

export interface ChargeFailedEvent extends WebhookBase {
  type: 'charge.failed'
  data: WebhookBase['data'] & {
    reason: string
  }
}

export interface PolicyCreatedEvent extends WebhookBase {
  type: 'policy.created'
  data: WebhookBase['data'] & {
    chargeAmount: string
    interval: number
    spendingCap: string
    metadataUrl: string
  }
}

export interface PolicyRevokedEvent extends WebhookBase {
  type: 'policy.revoked'
  data: WebhookBase['data'] & {
    endTime: number
  }
}

export interface PolicyCancelledByFailureEvent extends WebhookBase {
  type: 'policy.cancelled_by_failure'
  data: WebhookBase['data'] & {
    consecutiveFailures: number
    endTime: number
  }
}

export interface PolicyCompletedEvent extends WebhookBase {
  type: 'policy.completed'
  data: WebhookBase['data'] & {
    totalSpent: string
    chargeCount: number
  }
}

export type WebhookEvent =
  | ChargeSucceededEvent
  | ChargeFailedEvent
  | PolicyCreatedEvent
  | PolicyRevokedEvent
  | PolicyCancelledByFailureEvent
  | PolicyCompletedEvent

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export interface CheckoutMetadata {
  version: string
  plan: {
    name: string
    description: string
    tier?: string
    features?: string[]
  }
  merchant: {
    name: string
    logo?: string
    website?: string
    supportEmail?: string
  }
  billing?: {
    /** Charge amount in human-readable USDC (e.g. "9.99") */
    amount: string
    /** Currency identifier (default: "USDC") */
    currency: string
    /** Billing interval label */
    interval: BillingInterval
    /** Spending cap in human-readable USDC (must be >= amount) */
    cap: string
  }
  display?: {
    color?: string
    badge?: string
  }
}

export type BillingInterval = 'seconds' | 'minutes' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

// ---------------------------------------------------------------------------
// Fee breakdown
// ---------------------------------------------------------------------------

export interface FeeBreakdown {
  /** Total charge in human-readable USDC (e.g. "9.99") */
  total: string
  /** Amount merchant receives after fee */
  merchantReceives: string
  /** Protocol fee deducted */
  protocolFee: string
  /** Fee as percentage string (e.g. "2.5%") */
  feePercentage: string
}

// ---------------------------------------------------------------------------
// Plan-based checkout
// ---------------------------------------------------------------------------

export interface PlanCheckoutOptions {
  /** Relayer base URL (e.g. "https://relayer.autopayprotocol.com") */
  relayerUrl: string
  /** Merchant wallet address */
  merchant: string
  /** Plan ID (slug) */
  planId: string
  /** Redirect URL on successful subscription */
  successUrl: string
  /** Redirect URL on cancel */
  cancelUrl: string
  /** Optional spending cap override (defaults to plan's billing.cap) */
  spendingCap?: number
  /**
   * Consolidation chain to target. Determines which subdomain the checkout URL points to.
   * Defaults to 'base' (autopayprotocol.com).
   * @example 'flowEvm' → flow.autopayprotocol.com, 'base' → autopayprotocol.com
   */
  chain?: import('./constants').ChainKey
  /** Optional checkout app base URL override — takes precedence over `chain` if both are set */
  baseUrl?: string
  /** Optional API key for self-hosted relayers that lock down reads */
  apiKey?: string
}

export interface ResolvedPlan {
  metadata: CheckoutMetadata
  ipfsMetadataUrl: string | null
  relayerMetadataUrl: string
  amount: number
  intervalSeconds: number
  spendingCap?: number
}
