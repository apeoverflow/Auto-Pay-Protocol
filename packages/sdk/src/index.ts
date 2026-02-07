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
  CheckoutMetadata,
  FeeBreakdown,
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
  DEFAULT_CHECKOUT_BASE_URL,
} from './constants'
export type { ChainConfig } from './constants'

// Checkout
export { createCheckoutUrl, parseSuccessRedirect, resolveInterval } from './checkout'

// Webhooks
export { verifyWebhook, verifySignature, signPayload } from './webhooks'

// Amounts
export { formatUSDC, parseUSDC, calculateFeeBreakdown, formatInterval } from './amounts'

// Metadata
export { validateMetadata, createMetadata } from './metadata'
export type { MetadataValidationResult } from './metadata'
