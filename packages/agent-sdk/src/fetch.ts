import { parseUnits } from 'viem'
import type { AutoPayAgent } from './agent'
import { USDC_DECIMALS } from './constants'
import type { SubscriptionStore, StoreEntry } from './store'
import { MemoryStore } from './store'
import type { BridgeStatus, Subscription, IntervalPreset } from './types'

/** Refresh token when less than this many seconds remain before expiry */
const TOKEN_REFRESH_BUFFER_SECONDS = 300 // 5 minutes

/** Shape of the autopay block inside a 402 response body */
export interface AutoPayDiscovery {
  type: 'subscription'
  merchant: `0x${string}`
  plans: Array<{
    name: string
    amount: string
    currency: string
    interval: number | IntervalPreset
    description?: string
    metadataUrl?: string
  }>
  networks: Array<{
    chainId: number
    name: string
    policyManager: `0x${string}`
    usdc: `0x${string}`
  }>
  /** Relayer URL for querying subscriptions (e.g. GET /payers/:address/policies) */
  relayerUrl?: string
}

interface DiscoveryBody {
  accepts?: string[]
  autopay?: AutoPayDiscovery
}

export interface WrapFetchOptions {
  /** Persistent store for subscriptions. Default: in-memory (lost on restart). Use FileStore for persistence. */
  store?: SubscriptionStore
  /** Pick which plan to subscribe to. Receives the plans array, returns the index. Default: 0 (cheapest) */
  selectPlan?: (plans: AutoPayDiscovery['plans']) => number
  /** Spending cap strategy. Default: amount * 30 */
  spendingCap?: (amount: number) => number
  /** Called when a 402 response is received with an AutoPay discovery body */
  onDiscovery?: (url: string, discovery: AutoPayDiscovery) => void
  /** Called after a new subscription is created */
  onSubscribe?: (merchant: `0x${string}`, subscription: Subscription) => void
  /** Called when a cached subscription is reused */
  onReuse?: (merchant: `0x${string}`, policyId: `0x${string}`) => void
  /** Auto-bridge config. If set, bridges USDC from sourceChainId when balance is insufficient. */
  bridge?: {
    fromChainId: number
    sourceRpcUrl: string
    /** Extra USDC to bridge beyond the subscription cost (buffer). Default: 0 */
    extraAmount?: number
    slippage?: number
    onBridge?: (status: BridgeStatus) => void
  }
}

type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/**
 * Wrap `fetch` to automatically handle AutoPay 402 responses.
 *
 * When a request returns 402 with an `autopay` discovery body, the wrapper:
 * 1. Checks for a cached active subscription for that merchant
 * 2. If none (or expired), subscribes using the agent SDK
 * 3. Retries the original request with `Authorization: Bearer <policyId>`
 *
 * Subsequent requests to the same merchant reuse the cached policyId.
 *
 * @example
 * ```ts
 * const agent = new AutoPayAgent({ privateKey, chain: 'base' })
 * const fetchWithPay = wrapFetchWithSubscription(fetch, agent)
 *
 * // This transparently subscribes on first 402, then retries
 * const res = await fetchWithPay('https://api.service.com/data')
 * const data = await res.json()
 * ```
 */
export function wrapFetchWithSubscription(
  fetchFn: FetchFn,
  agent: AutoPayAgent,
  options: WrapFetchOptions = {},
): FetchFn {
  const store = options.store ?? new MemoryStore()
  const selectPlan = options.selectPlan ?? (() => 0)
  const getSpendingCap = options.spendingCap ?? ((amount: number) => amount * 30)

  return async function wrappedFetch(
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> {
    // If the request already has an Authorization header, pass through
    const headers = new Headers(init?.headers)
    if (headers.has('authorization')) {
      return fetchFn(input, init)
    }

    // Check if we have a cached subscription for this URL's origin
    // We don't know the merchant yet (it's in the 402 body), so just make the request
    const response = await fetchFn(input, init)

    if (response.status !== 402) {
      return response
    }

    // Clone before consuming body so we can return the original if it's not autopay
    const cloned = response.clone()
    const discovery = await parseDiscovery(response)
    if (!discovery) {
      return cloned
    }

    const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    options.onDiscovery?.(requestUrl, discovery)

    const merchantKey = discovery.merchant.toLowerCase()

    // 1. Check local store first (trusted, fast)
    const cached = await store.get(merchantKey)
    if (cached) {
      const token = await getOrRefreshToken(agent, store, merchantKey, cached)
      const retryRes = await fetchWithBearer(fetchFn, input, init, token)
      if (retryRes.status !== 402) {
        options.onReuse?.(discovery.merchant, cached.policyId)
        return retryRes
      }
      // Stored subscription is stale (expired/cancelled) — remove
      await store.delete(merchantKey)
    }

    // 2. Query relayer for existing policies (fallback if local store is empty)
    //    Uses globalThis.fetch to avoid recursion if fetchFn is a wrapped fetch
    if (!cached && discovery.relayerUrl) {
      const relayerPolicyId = await queryRelayerForPolicy(
        globalThis.fetch,
        discovery.relayerUrl,
        agent.address,
        discovery.merchant,
        agent.chain.chainId,
      )
      if (relayerPolicyId) {
        const entry: StoreEntry = { policyId: relayerPolicyId }
        const token = await getOrRefreshToken(agent, store, merchantKey, entry)
        const retryRes = await fetchWithBearer(fetchFn, input, init, token)
        if (retryRes.status !== 402) {
          // Relayer was right — persist locally for next time (token already cached in entry)
          await store.set(merchantKey, entry)
          options.onReuse?.(discovery.merchant, relayerPolicyId)
          return retryRes
        }
        // Relayer returned a stale policyId — fall through to subscribe
      }
    }

    // 3. Subscribe to the merchant
    const planIndex = selectPlan(discovery.plans)
    const plan = discovery.plans[planIndex]
    if (!plan) {
      // Return a synthetic 402 if plan selection fails
      return new Response(
        JSON.stringify({ error: 'No suitable plan found', ...discovery }),
        { status: 402, headers: { 'content-type': 'application/json' } },
      )
    }

    const amount = Number(plan.amount)

    // Auto-bridge if balance is insufficient and bridge config is provided
    if (options.bridge) {
      const balance = await agent.getBalance()
      const needed = parseUnits(String(amount), USDC_DECIMALS)
      if (balance < needed) {
        const bridgeAmount = amount + (options.bridge.extraAmount ?? 0)
        await agent.bridgeUsdc({
          fromChainId: options.bridge.fromChainId,
          amount: bridgeAmount,
          sourceRpcUrl: options.bridge.sourceRpcUrl,
          slippage: options.bridge.slippage,
          onStatus: options.bridge.onBridge,
        })
      }
    }

    const sub = await agent.subscribe({
      merchant: discovery.merchant,
      amount,
      interval: plan.interval,
      spendingCap: getSpendingCap(amount),
      metadataUrl: plan.metadataUrl,
    })

    // Cache the subscription + signed token
    const entry: StoreEntry = { policyId: sub.policyId }
    const token = await getOrRefreshToken(agent, store, merchantKey, entry)
    await store.set(merchantKey, entry)
    options.onSubscribe?.(discovery.merchant, sub)

    // Retry with the signed Bearer token
    return fetchWithBearer(fetchFn, input, init, token)
  }
}

async function parseDiscovery(response: Response): Promise<AutoPayDiscovery | null> {
  try {
    const body = (await response.json()) as DiscoveryBody
    if (
      body.autopay &&
      body.autopay.merchant &&
      body.autopay.plans &&
      body.autopay.plans.length > 0
    ) {
      return body.autopay
    }
    return null
  } catch {
    return null
  }
}

/**
 * Query the relayer's payer endpoint for an existing active policy with a specific merchant.
 * Returns the first matching policyId or null.
 */
async function queryRelayerForPolicy(
  fetchFn: FetchFn,
  relayerUrl: string,
  payerAddress: string,
  merchantAddress: string,
  chainId: number,
): Promise<`0x${string}` | null> {
  try {
    const base = relayerUrl.replace(/\/$/, '')
    const url = `${base}/payers/${payerAddress}/policies?chain_id=${chainId}&active=true`
    const res = await fetchFn(url)
    if (!res.ok) return null

    const data = (await res.json()) as {
      policies?: Array<{ policyId: string; merchant: string; active: boolean }>
    }

    const merchantLower = merchantAddress.toLowerCase()
    const match = data.policies?.find(
      (p) => p.merchant.toLowerCase() === merchantLower && p.active,
    )

    return match ? (match.policyId as `0x${string}`) : null
  } catch {
    // Relayer unreachable — silently fall through to subscribe
    return null
  }
}

/**
 * Reuse a cached token if it's still valid (>5 min remaining), otherwise sign a fresh one.
 * Mutates the entry in-place so the caller can persist it.
 */
async function getOrRefreshToken(
  agent: AutoPayAgent,
  store: SubscriptionStore,
  merchantKey: string,
  entry: StoreEntry,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (entry.token && entry.tokenExpiry && entry.tokenExpiry > now + TOKEN_REFRESH_BUFFER_SECONDS) {
    return entry.token
  }

  // Sign a fresh token and cache it on the entry
  const token = await agent.createBearerToken(entry.policyId)
  // Parse expiry from the token (format: {policyId}.{expiry}.{sig})
  const expiry = Number(token.split('.')[1])
  entry.token = token
  entry.tokenExpiry = expiry
  // Persist updated token to store
  await store.set(merchantKey, entry)
  return token
}

function fetchWithBearer(
  fetchFn: FetchFn,
  input: string | URL | Request,
  init: RequestInit | undefined,
  token: string,
): Promise<Response> {
  const headers = new Headers(init?.headers)
  headers.set('authorization', `Bearer ${token}`)
  return fetchFn(input, { ...init, headers })
}
