import type { CheckoutMetadata } from './types'

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

  if (options.color || options.badge) {
    metadata.display = {}
    if (options.color) metadata.display.color = options.color
    if (options.badge) metadata.display.badge = options.badge
  }

  return metadata
}
