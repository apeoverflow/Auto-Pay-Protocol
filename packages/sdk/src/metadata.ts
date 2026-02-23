import type { CheckoutMetadata, BillingInterval } from './types'

const VALID_BILLING_INTERVALS: BillingInterval[] = ['seconds', 'minutes', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']

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

  return metadata
}
