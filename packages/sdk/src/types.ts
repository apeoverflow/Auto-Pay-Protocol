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
  | 'subscriber.low_approval'
  | 'subscriber.approval_recovered'

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

/**
 * Shared payload fields for the `subscriber.*` webhook events. AutoPay's
 * relayer emits ONE event per active policy so each merchant hears about
 * their own at-risk subscribers with the same per-payer metrics attached.
 */
interface SubscriberEventDataBase {
  /** For low_approval: 1..N (1 = first warning). Always 0 for approval_recovered. */
  notificationStage: number
  /** Current USDC allowance in µUSDC (6-decimal integer as string). */
  currentAllowance: string
  /** Projected 12-month billing for this payer across all active policies (µUSDC). */
  projected12mo: string
  /** Threshold that triggered the warning: currentAllowance < threshold. `"0"` for approval_recovered. */
  threshold: string
  /**
   * ISO timestamp — when the current (or most recently closed) low-approval
   * episode began. May be absent for events emitted from manually-manipulated
   * state where no prior episode timestamp was recorded.
   */
  lowApprovalSince?: string
}

/**
 * Fires when a payer enters or advances within a low-approval episode.
 * Use it to send merchant-branded save-my-sub emails independent of
 * AutoPay's built-in ones, or to drive an in-app risk banner.
 *
 * `notificationStage` mirrors AutoPay's escalation counter — 1 is the
 * first warning, later stages fire on the configured backoff schedule
 * (default `0,3,5,15,30,30` days between stages).
 */
export interface SubscriberLowApprovalEvent extends WebhookBase {
  type: 'subscriber.low_approval'
  data: WebhookBase['data'] & SubscriberEventDataBase
}

/**
 * Fires when a payer's allowance climbs back above the low-approval
 * threshold after having been in an episode. Complements
 * `subscriber.low_approval` — one recovery event per episode close.
 *
 * All numeric fields are populated symmetrically with the low_approval
 * event: `notificationStage=0` (reset), `threshold="0"` (not applicable
 * during recovery), `currentAllowance` is the recovered amount, and
 * `projected12mo` is the payer's current projection.
 */
export interface SubscriberApprovalRecoveredEvent extends WebhookBase {
  type: 'subscriber.approval_recovered'
  data: WebhookBase['data'] & SubscriberEventDataBase
}

export type WebhookEvent =
  | ChargeSucceededEvent
  | ChargeFailedEvent
  | PolicyCreatedEvent
  | PolicyRevokedEvent
  | PolicyCancelledByFailureEvent
  | PolicyCompletedEvent
  | SubscriberLowApprovalEvent
  | SubscriberApprovalRecoveredEvent

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

/**
 * Subscriber-info field keys that can be collected at checkout via
 * `metadata.checkout.requiredFields` / `optionalFields`, or the
 * URL override `?fields=email:r,name:o,...`.
 */
export type SubscriberFieldKey = 'email' | 'name' | 'discord' | 'telegram' | 'twitter' | 'mobile'

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
  /**
   * Merchant-configured subscriber-info collection at checkout. When set,
   * AutoPay's checkout page renders a form asking the payer for these
   * fields before the wallet-connect step. Required fields block progress
   * until filled; optional fields can be skipped.
   *
   * The URL param `?fields=email:r,discord:o` overrides this per-checkout.
   *
   * The two lists must be disjoint (a key is either required OR optional,
   * not both) and drawn from `SubscriberFieldKey`.
   */
  checkout?: {
    requiredFields?: SubscriberFieldKey[]
    optionalFields?: SubscriberFieldKey[]
  }
  /**
   * Optional non-EVM chains the merchant has enabled for this plan
   * (e.g. 'tempo', 'arcTestnet'). EVM chains are always available.
   */
  supportedChains?: string[]
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

// ---------------------------------------------------------------------------
// Merchant subscribers API
// ---------------------------------------------------------------------------

/**
 * Contact + notification-cadence state for a payer, as surfaced by the
 * merchant subscribers API. Verified-only email exposure: `email` is
 * populated iff `emailVerified === true`.
 */
export interface MerchantSubscriberContact {
  /** Only populated when `emailVerified` is true. Merchants never see unverified addresses. */
  email: string | null
  emailVerified: boolean
  notificationsOptedOut: boolean
  /** 0 when healthy, 1..N when currently in a low-approval episode. */
  notificationStage: number
  /** Convenience alias for `notificationStage > 0`. */
  lowApproval: boolean
  /** ISO timestamp — when the current low-approval episode began, null when healthy. */
  lowApprovalSince: string | null
  /** Last USDC allowance the monitor observed (µUSDC, 6-decimal integer as string). */
  lastAllowanceMicro: string | null
  lastCheckedAt: string | null
}

/**
 * A subscriber row returned by `GET /merchants/:address/subscribers`
 * (or the at-risk variant). Combines the per-policy on-chain state with
 * the payer's contact/notification state (per chain).
 */
export interface MerchantSubscriber {
  policyId: string
  chainId: number
  payer: string
  planId: string | null
  formData: Record<string, string>
  active: boolean
  chargeAmount: string
  intervalSeconds: number
  createdAt: string
  contact: MerchantSubscriberContact
  /**
   * Projected 12-month billing across ALL of this payer's active
   * policies on this chain (µUSDC as string). Sum of `chargeAmount ×
   * (365d / interval)` truncated by remaining spending cap per policy.
   */
  projected12moMicro: string | null
}

export interface MerchantSubscribersResponse {
  subscribers: MerchantSubscriber[]
  total: number
  page: number
  limit: number
}
