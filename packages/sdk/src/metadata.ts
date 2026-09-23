import type { CheckoutMetadata, BillingInterval, SubscriberFieldKey } from './types'

const VALID_BILLING_INTERVALS: BillingInterval[] = ['seconds', 'minutes', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']

const VALID_SUBSCRIBER_FIELDS: SubscriberFieldKey[] = ['email', 'name', 'discord', 'telegram', 'twitter', 'mobile']

function validateFieldList(list: unknown, listName: string, errors: string[]): SubscriberFieldKey[] {
  if (!Array.isArray(list)) {
    errors.push(`"${listName}" must be an array of subscriber field keys if provided`)
    return []
  }
  const invalid = list.filter((k) => typeof k !== 'string' || !VALID_SUBSCRIBER_FIELDS.includes(k as SubscriberFieldKey))
  if (invalid.length > 0) {
    errors.push(`"${listName}" contains invalid keys: ${invalid.join(', ')}. Allowed: ${VALID_SUBSCRIBER_FIELDS.join(', ')}`)
  }
  return list.filter((k): k is SubscriberFieldKey =>
    typeof k === 'string' && VALID_SUBSCRIBER_FIELDS.includes(k as SubscriberFieldKey)
  )
}

export interface MetadataValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate a metadata JSON object against the AutoPay metadata schema.
 *
 * @example
 * ```ts
 * const { valid, errors } = validateMetadata(jsonData)
 * if (!valid) console.error(errors)
 * ```
 */
export function validateMetadata(data: unknown): MetadataValidationResult {
  const errors: string[] = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Metadata must be an object'] }
  }

  const obj = data as Record<string, unknown>

  // version
  if (typeof obj.version !== 'string' || !obj.version) {
    errors.push('Missing or invalid "version" (must be a non-empty string)')
  }

  // plan
  if (!obj.plan || typeof obj.plan !== 'object') {
    errors.push('Missing or invalid "plan" (must be an object)')
  } else {
    const plan = obj.plan as Record<string, unknown>
    if (typeof plan.name !== 'string' || !plan.name) {
      errors.push('Missing or invalid "plan.name" (must be a non-empty string)')
    }
    if (typeof plan.description !== 'string' || !plan.description) {
      errors.push('Missing or invalid "plan.description" (must be a non-empty string)')
    }
    if (plan.tier !== undefined && typeof plan.tier !== 'string') {
      errors.push('"plan.tier" must be a string if provided')
    }
    if (plan.features !== undefined) {
      if (!Array.isArray(plan.features) || !plan.features.every((f) => typeof f === 'string')) {
        errors.push('"plan.features" must be an array of strings if provided')
      }
    }
  }

  // merchant
  if (!obj.merchant || typeof obj.merchant !== 'object') {
    errors.push('Missing or invalid "merchant" (must be an object)')
  } else {
    const merchant = obj.merchant as Record<string, unknown>
    if (typeof merchant.name !== 'string' || !merchant.name) {
      errors.push('Missing or invalid "merchant.name" (must be a non-empty string)')
    }
    if (merchant.logo !== undefined && typeof merchant.logo !== 'string') {
      errors.push('"merchant.logo" must be a string if provided')
    }
    if (merchant.website !== undefined && typeof merchant.website !== 'string') {
      errors.push('"merchant.website" must be a string if provided')
    }
    if (merchant.supportEmail !== undefined && typeof merchant.supportEmail !== 'string') {
      errors.push('"merchant.supportEmail" must be a string if provided')
    }
  }

  // billing (optional, but if present all fields are required)
  if (obj.billing !== undefined) {
    if (typeof obj.billing !== 'object' || obj.billing === null) {
      errors.push('"billing" must be an object if provided')
    } else {
      const billing = obj.billing as Record<string, unknown>

      if (typeof billing.amount !== 'string' || !billing.amount) {
        errors.push('Missing or invalid "billing.amount" (must be a non-empty string)')
      } else {
        const parsed = Number(billing.amount)
        if (isNaN(parsed) || parsed <= 0) {
          errors.push('"billing.amount" must be a positive number string')
        }
      }

      if (typeof billing.currency !== 'string' || !billing.currency) {
        errors.push('Missing or invalid "billing.currency" (must be a non-empty string)')
      }

      if (typeof billing.interval !== 'string' || !billing.interval) {
        errors.push('Missing or invalid "billing.interval" (must be a non-empty string)')
      } else if (!VALID_BILLING_INTERVALS.includes(billing.interval as BillingInterval)) {
        errors.push(`"billing.interval" must be one of: ${VALID_BILLING_INTERVALS.join(', ')}`)
      }

      if (typeof billing.cap !== 'string' || !billing.cap) {
        errors.push('Missing or invalid "billing.cap" (must be a non-empty string)')
      } else {
        const parsedCap = Number(billing.cap)
        if (isNaN(parsedCap) || parsedCap <= 0) {
          errors.push('"billing.cap" must be a positive number string')
        } else if (typeof billing.amount === 'string' && !isNaN(Number(billing.amount))) {
          if (parsedCap < Number(billing.amount)) {
            errors.push('"billing.cap" must be >= "billing.amount"')
          }
        }
      }
    }
  }

  // display (optional)
  if (obj.display !== undefined) {
    if (typeof obj.display !== 'object' || obj.display === null) {
      errors.push('"display" must be an object if provided')
    } else {
      const display = obj.display as Record<string, unknown>
      if (display.color !== undefined && typeof display.color !== 'string') {
        errors.push('"display.color" must be a string if provided')
      }
      if (display.badge !== undefined && typeof display.badge !== 'string') {
        errors.push('"display.badge" must be a string if provided')
      }
    }
  }

  // checkout (optional) — subscriber-info fields to collect at checkout.
  // requiredFields and optionalFields must be disjoint: a key is either
  // required OR optional, not both. Enforcing this here (as well as
  // server-side) surfaces plan-editor bugs at build time in SDK users'
  // pipelines instead of at runtime.
  if (obj.checkout !== undefined) {
    // typeof [] === 'object', so we have to reject arrays explicitly.
    if (typeof obj.checkout !== 'object' || obj.checkout === null || Array.isArray(obj.checkout)) {
      errors.push('"checkout" must be an object if provided')
    } else {
      const checkout = obj.checkout as Record<string, unknown>
      const required = checkout.requiredFields !== undefined
        ? validateFieldList(checkout.requiredFields, 'checkout.requiredFields', errors)
        : []
      const optional = checkout.optionalFields !== undefined
        ? validateFieldList(checkout.optionalFields, 'checkout.optionalFields', errors)
        : []
      const overlap = required.filter((k) => optional.includes(k))
      if (overlap.length > 0) {
        errors.push(`"checkout" fields ${overlap.join(', ')} appear in BOTH requiredFields and optionalFields — must be in only one`)
      }
    }
  }

  // supportedChains (optional) — array of chain keys the merchant enabled
  // for this plan. Values are chain slugs (strings) — we don't validate
  // against the full chain list here since the SDK is chain-registry-agnostic.
  if (obj.supportedChains !== undefined) {
    if (!Array.isArray(obj.supportedChains) || !obj.supportedChains.every((c) => typeof c === 'string')) {
      errors.push('"supportedChains" must be an array of strings if provided')
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Create a valid metadata object with sensible defaults.
 *
 * @example
 * ```ts
 * const metadata = createMetadata({
 *   planName: 'Pro',
 *   planDescription: 'All premium features',
 *   merchantName: 'Acme Corp',
 * })
 * ```
 */
export function createMetadata(options: {
  planName: string
  planDescription: string
  merchantName: string
  tier?: string
  features?: string[]
  logo?: string
  website?: string
  supportEmail?: string
  /** Charge amount in human-readable USDC (e.g. "9.99") */
  amount?: string
  /** Billing interval */
  interval?: BillingInterval
  /** Spending cap in human-readable USDC (must be >= amount) */
  cap?: string
  /** Currency (default: "USDC") */
  currency?: string
  color?: string
  badge?: string
  /**
   * Subscriber-info fields to collect at checkout. Required fields block
   * checkout progress until filled; optional fields can be skipped.
   * Verified emails unlock low-approval warning emails from AutoPay AND
   * expose the verified address to your merchant subscribers API.
   */
  requiredFields?: SubscriberFieldKey[]
  optionalFields?: SubscriberFieldKey[]
  /** Optional non-EVM chains this plan supports. */
  supportedChains?: string[]
}): CheckoutMetadata {
  const metadata: CheckoutMetadata = {
    version: '1.0',
    plan: {
      name: options.planName,
      description: options.planDescription,
    },
    merchant: {
      name: options.merchantName,
    },
  }

  if (options.tier) metadata.plan.tier = options.tier
  if (options.features) metadata.plan.features = options.features
  if (options.logo) metadata.merchant.logo = options.logo
  if (options.website) metadata.merchant.website = options.website
  if (options.supportEmail) metadata.merchant.supportEmail = options.supportEmail

  if (options.amount && options.interval && options.cap) {
    metadata.billing = {
      amount: options.amount,
      currency: options.currency ?? 'USDC',
      interval: options.interval,
      cap: options.cap,
    }
  }

  if (options.color || options.badge) {
    metadata.display = {}
    if (options.color) metadata.display.color = options.color
    if (options.badge) metadata.display.badge = options.badge
  }

  const hasRequired = options.requiredFields && options.requiredFields.length > 0
  const hasOptional = options.optionalFields && options.optionalFields.length > 0
  if (hasRequired || hasOptional) {
    metadata.checkout = {}
    if (hasRequired) metadata.checkout.requiredFields = options.requiredFields
    if (hasOptional) metadata.checkout.optionalFields = options.optionalFields
  }

  if (options.supportedChains && options.supportedChains.length > 0) {
    metadata.supportedChains = options.supportedChains
  }

  return metadata
}
