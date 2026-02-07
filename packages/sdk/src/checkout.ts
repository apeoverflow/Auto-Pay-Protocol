import { AutoPayCheckoutError } from './errors'
import { DEFAULT_CHECKOUT_BASE_URL, intervals as presetIntervals, MIN_INTERVAL, MAX_INTERVAL } from './constants'
import type { CheckoutOptions, IntervalPreset, SuccessRedirect } from './types'

const INTERVAL_MAP: Record<IntervalPreset, number> = {
  weekly: presetIntervals.weekly,
  biweekly: presetIntervals.biweekly,
  monthly: presetIntervals.monthly,
  quarterly: presetIntervals.quarterly,
  yearly: presetIntervals.yearly,
}

/** Resolve an interval preset or number to seconds */
export function resolveInterval(interval: IntervalPreset | number): number {
  if (typeof interval === 'number') return interval
  const seconds = INTERVAL_MAP[interval]
  if (!seconds) {
    throw new AutoPayCheckoutError(
      `Invalid interval preset "${interval}". Use: ${Object.keys(INTERVAL_MAP).join(', ')} or a number of seconds.`,
    )
  }
  return seconds
}

function isValidAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

/**
 * Build a checkout URL that a merchant can redirect users to.
 *
 * @example
 * ```ts
 * const url = createCheckoutUrl({
 *   merchant: '0x2B8b...',
 *   amount: 9.99,
 *   interval: 'monthly',
 *   metadataUrl: 'https://mysite.com/plans/pro.json',
 *   successUrl: 'https://mysite.com/success',
 *   cancelUrl: 'https://mysite.com/cancel',
 * })
 * ```
 */
export function createCheckoutUrl(options: CheckoutOptions): string {
  const { merchant, amount, interval, metadataUrl, successUrl, cancelUrl, spendingCap, baseUrl } = options

  // Validate merchant address
  if (!merchant || !isValidAddress(merchant)) {
    throw new AutoPayCheckoutError(`Invalid merchant address: ${merchant}`)
  }

  // Validate amount
  if (typeof amount !== 'number' || amount <= 0 || !Number.isFinite(amount)) {
    throw new AutoPayCheckoutError(`Invalid amount: ${amount}. Must be a positive number.`)
  }

  // Resolve and validate interval
  const intervalSeconds = resolveInterval(interval)
  if (intervalSeconds < MIN_INTERVAL || intervalSeconds > MAX_INTERVAL) {
    throw new AutoPayCheckoutError(
      `Interval ${intervalSeconds}s out of range. Must be between ${MIN_INTERVAL}s and ${MAX_INTERVAL}s.`,
    )
  }

  // Validate URLs
  if (!isValidUrl(metadataUrl)) {
    throw new AutoPayCheckoutError(`Invalid metadata URL: ${metadataUrl}`)
  }
  if (!isValidUrl(successUrl)) {
    throw new AutoPayCheckoutError(`Invalid success URL: ${successUrl}`)
  }
  if (!isValidUrl(cancelUrl)) {
    throw new AutoPayCheckoutError(`Invalid cancel URL: ${cancelUrl}`)
  }

  // Validate spending cap
  if (spendingCap !== undefined) {
    if (typeof spendingCap !== 'number' || spendingCap <= 0 || !Number.isFinite(spendingCap)) {
      throw new AutoPayCheckoutError(`Invalid spending cap: ${spendingCap}. Must be a positive number.`)
    }
    if (spendingCap < amount) {
      throw new AutoPayCheckoutError(`Spending cap (${spendingCap}) must be >= amount (${amount}).`)
    }
  }

  const base = baseUrl || DEFAULT_CHECKOUT_BASE_URL
  const url = new URL('/checkout', base)

  url.searchParams.set('merchant', merchant)
  url.searchParams.set('amount', String(amount))
  url.searchParams.set('interval', String(intervalSeconds))
  url.searchParams.set('metadata_url', metadataUrl)
  url.searchParams.set('success_url', successUrl)
  url.searchParams.set('cancel_url', cancelUrl)

  if (spendingCap !== undefined) {
    url.searchParams.set('spending_cap', String(spendingCap))
  }

  return url.toString()
}

/**
 * Parse the query params from the success redirect URL.
 *
 * After a user subscribes, they are redirected to the merchant's `successUrl`
 * with `?policyId=0x...&txHash=0x...` appended.
 *
 * @example
 * ```ts
 * // On your success page:
 * const { policyId, txHash } = parseSuccessRedirect(window.location.search)
 * ```
 */
export function parseSuccessRedirect(queryString: string): SuccessRedirect {
  const params = new URLSearchParams(queryString)
  const policyId = params.get('policyId')
  const txHash = params.get('txHash')

  if (!policyId) {
    throw new AutoPayCheckoutError('Missing policyId in success redirect URL')
  }
  if (!txHash) {
    throw new AutoPayCheckoutError('Missing txHash in success redirect URL')
  }

  return { policyId, txHash }
}
