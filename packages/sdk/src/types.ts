// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export type IntervalPreset = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

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
  /** Optional base URL override (default: https://autopayprotocol.com) */
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

export type WebhookEvent =
  | ChargeSucceededEvent
  | ChargeFailedEvent
  | PolicyCreatedEvent
  | PolicyRevokedEvent
  | PolicyCancelledByFailureEvent

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
  display?: {
    color?: string
    badge?: string
  }
}

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
