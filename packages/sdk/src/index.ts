// Types
export type {
  CheckoutOptions,
  SuccessRedirect,
  IntervalPreset,
  WebhookEvent,
  WebhookEventType,
  ChargeSucceededEvent,
  ChargeFailedEvent,
  PolicyCreatedEvent,
  PolicyRevokedEvent,
  PolicyCancelledByFailureEvent,
  PolicyCompletedEvent,
  CheckoutMetadata,
  BillingInterval,
  FeeBreakdown,
  PlanCheckoutOptions,
  ResolvedPlan,
} from './types'

// Errors
export {
  AutoPayError,
  AutoPayWebhookError,
  AutoPayCheckoutError,
  AutoPayMetadataError,
} from './errors'

// Constants
export {
  intervals,
  PROTOCOL_FEE_BPS,
  USDC_DECIMALS,
  MIN_INTERVAL,
  MAX_INTERVAL,
  MAX_RETRIES,
  chains,
  DEFAULT_CHAIN,
  DEFAULT_CHECKOUT_BASE_URL,
  DEFAULT_IPFS_GATEWAY,
  ipfsGatewayUrl,
} from './constants'
export type { ChainConfig, ChainKey } from './constants'

// Checkout
export { createCheckoutUrl, createCheckoutUrlFromPlan, resolvePlan, parseSuccessRedirect, resolveInterval } from './checkout'

// Webhooks
export { verifyWebhook, verifySignature, signPayload } from './webhooks'

// Amounts
export { formatUSDC, parseUSDC, calculateFeeBreakdown, formatInterval } from './amounts'

// Metadata
export { validateMetadata, createMetadata } from './metadata'
export type { MetadataValidationResult } from './metadata'
