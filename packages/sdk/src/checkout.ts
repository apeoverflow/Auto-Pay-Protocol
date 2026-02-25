import { AutoPayCheckoutError } from './errors'
import { DEFAULT_CHECKOUT_BASE_URL, DEFAULT_CHAIN, chains, intervals as presetIntervals, MIN_INTERVAL, MAX_INTERVAL } from './constants'
import type { CheckoutOptions, IntervalPreset, SuccessRedirect, PlanCheckoutOptions, ResolvedPlan, CheckoutMetadata } from './types'

const INTERVAL_MAP: Record<IntervalPreset, number> = {
  seconds: presetIntervals.seconds,
  minutes: presetIntervals.minutes,
  daily: presetIntervals.daily,
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
  const { merchant, amount, interval, metadataUrl, successUrl, cancelUrl, spendingCap, ipfsMetadataUrl, chain, baseUrl } = options

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

  // Priority: explicit baseUrl > chain config lookup > default (Base)
  const resolvedChain = chain || DEFAULT_CHAIN
  const base = baseUrl || chains[resolvedChain]?.checkoutBaseUrl || DEFAULT_CHECKOUT_BASE_URL
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

  if (ipfsMetadataUrl) {
    url.searchParams.set('ipfs_metadata_url', ipfsMetadataUrl)
  }

  return url.toString()
}

/**
 * Parse the query params from the success redirect URL.
 *
 * After a user subscribes, they are redirected to the merchant's `successUrl`
 * with `?policy_id=0x...&tx_hash=0x...` appended.
 *
 * @example
 * ```ts
 * // On your success page:
 * const { policyId, txHash } = parseSuccessRedirect(window.location.search)
 * ```
 */
export function parseSuccessRedirect(queryString: string): SuccessRedirect {
  const params = new URLSearchParams(queryString)
  const policyId = params.get('policy_id')
  const txHash = params.get('tx_hash')

  if (!policyId) {
    throw new AutoPayCheckoutError('Missing policy_id in success redirect URL')
  }
  if (!txHash) {
    throw new AutoPayCheckoutError('Missing tx_hash in success redirect URL')
  }

  return { policyId, txHash }
}

/**
 * Fetch and validate a plan from the relayer API.
 * Returns structured plan data with billing params and metadata URLs.
 *
 * @example
 * ```ts
 * const plan = await resolvePlan({
 *   relayerUrl: 'https://relayer.autopayprotocol.com',
 *   merchant: '0x2B8b...',
 *   planId: 'pro',
 *   successUrl: 'https://mysite.com/success',
 *   cancelUrl: 'https://mysite.com/cancel',
 * })
 * console.log(plan.amount, plan.intervalSeconds, plan.ipfsMetadataUrl)
 * ```
 */
export async function resolvePlan(options: PlanCheckoutOptions): Promise<ResolvedPlan> {
  const { relayerUrl, merchant, planId, apiKey } = options

  if (!merchant || !isValidAddress(merchant)) {
    throw new AutoPayCheckoutError(`Invalid merchant address: ${merchant}`)
  }
  if (!relayerUrl) {
    throw new AutoPayCheckoutError('relayerUrl is required')
  }
  if (!planId) {
    throw new AutoPayCheckoutError('planId is required')
  }

  const url = `${relayerUrl.replace(/\/$/, '')}/merchants/${merchant}/plans/${planId}`
  const headers: Record<string, string> = {}
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }

  let res: Response
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) })
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    throw new AutoPayCheckoutError(
      isTimeout
        ? `Relayer request timed out after 10s: ${url}`
        : `Relayer request failed: ${String(err)}`,
    )
  }

  if (res.status === 404) {
    throw new AutoPayCheckoutError(`Plan not found: ${merchant}/${planId}`)
  }
  if (!res.ok) {
    throw new AutoPayCheckoutError(`Failed to fetch plan (HTTP ${res.status})`)
  }

  const plan = await res.json() as {
    id: string
    merchantAddress: string
    metadata: CheckoutMetadata
    status: string
    amount: number | null
    intervalLabel: string | null
    spendingCap: number | null
    ipfsCid: string | null
    ipfsMetadataUrl: string | null
  }

  if (plan.status !== 'active') {
    throw new AutoPayCheckoutError(`Plan "${planId}" is not active (status: ${plan.status})`)
  }

  const billing = plan.metadata?.billing
  if (!billing?.amount || !billing?.interval) {
    throw new AutoPayCheckoutError(`Plan "${planId}" is missing billing.amount or billing.interval`)
  }

  const amount = Number(billing.amount)
  if (isNaN(amount) || amount <= 0) {
    throw new AutoPayCheckoutError(`Plan "${planId}" has invalid billing.amount: ${billing.amount}`)
  }

  // Handle both preset labels ("monthly") and numeric strings ("2592000")
  const rawInterval = billing.interval
  const intervalSeconds = typeof rawInterval === 'string' && /^\d+$/.test(rawInterval)
    ? parseInt(rawInterval, 10)
    : resolveInterval(rawInterval as IntervalPreset)

  const relayerMetadataUrl = `${relayerUrl.replace(/\/$/, '')}/metadata/${merchant}/${planId}`
  const ipfsMetadataUrl = plan.ipfsMetadataUrl || null

  const parsedCap = billing.cap ? Number(billing.cap) : undefined
  const spendingCap = parsedCap !== undefined && Number.isFinite(parsedCap) ? parsedCap : undefined

  return {
    metadata: plan.metadata,
    ipfsMetadataUrl,
    relayerMetadataUrl,
    amount,
    intervalSeconds,
    spendingCap,
  }
}

/**
 * Build a checkout URL from a relayer-hosted plan.
 * Fetches plan details from the relayer, extracts billing params,
 * and delegates to `createCheckoutUrl()`.
 *
 * Uses the IPFS metadata URL when available, falls back to the relayer metadata URL.
 *
 * @example
 * ```ts
 * const url = await createCheckoutUrlFromPlan({
 *   relayerUrl: 'https://relayer.autopayprotocol.com',
 *   merchant: '0x2B8b...',
 *   planId: 'pro',
 *   successUrl: 'https://mysite.com/success',
 *   cancelUrl: 'https://mysite.com/cancel',
 * })
 * // Redirect the user to `url`
 * ```
 */
export async function createCheckoutUrlFromPlan(options: PlanCheckoutOptions): Promise<string> {
  const { successUrl, cancelUrl, spendingCap: capOverride, chain, baseUrl } = options

  const plan = await resolvePlan(options)

  // Primary: relayer URL (mutable, always up-to-date)
  // Fallback: IPFS URL (immutable, works if relayer is down)
  const metadataUrl = plan.relayerMetadataUrl
  const ipfsMetadataUrl = plan.ipfsMetadataUrl || undefined
  const cap = capOverride ?? plan.spendingCap

  return createCheckoutUrl({
    merchant: options.merchant,
    amount: plan.amount,
    interval: plan.intervalSeconds,
    metadataUrl,
    successUrl,
    cancelUrl,
    spendingCap: cap,
    ipfsMetadataUrl,
    chain,
    baseUrl,
  })
}
