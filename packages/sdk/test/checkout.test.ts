import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCheckoutUrl, createCheckoutUrlFromPlan, resolvePlan, parseSuccessRedirect, resolveInterval } from '../src/checkout'
import { AutoPayCheckoutError } from '../src/errors'
import { DEFAULT_CHECKOUT_BASE_URL } from '../src/constants'

describe('resolveInterval', () => {
  it('resolves preset strings to seconds', () => {
    expect(resolveInterval('weekly')).toBe(604_800)
    expect(resolveInterval('biweekly')).toBe(1_209_600)
    expect(resolveInterval('monthly')).toBe(2_592_000)
    expect(resolveInterval('quarterly')).toBe(7_776_000)
    expect(resolveInterval('yearly')).toBe(31_536_000)
  })

  it('passes through numeric seconds', () => {
    expect(resolveInterval(86400)).toBe(86400)
    expect(resolveInterval(3600)).toBe(3600)
  })

  it('throws on invalid preset', () => {
    expect(() => resolveInterval('invalid-preset' as any)).toThrow(AutoPayCheckoutError)
  })
})

describe('createCheckoutUrl', () => {
  const validOptions = {
    merchant: '0x2B8b9182c1c3A9bEf4a60951D9B7F49420D12B9B',
    amount: 9.99,
    interval: 'monthly' as const,
    metadataUrl: 'https://mysite.com/plans/pro.json',
    successUrl: 'https://mysite.com/success',
    cancelUrl: 'https://mysite.com/cancel',
  }

  it('builds a valid checkout URL', () => {
    const url = createCheckoutUrl(validOptions)
    const parsed = new URL(url)

    expect(parsed.origin).toBe(DEFAULT_CHECKOUT_BASE_URL)
    expect(parsed.pathname).toBe('/checkout')
    expect(parsed.searchParams.get('merchant')).toBe(validOptions.merchant)
    expect(parsed.searchParams.get('amount')).toBe('9.99')
    expect(parsed.searchParams.get('interval')).toBe('2592000')
    expect(parsed.searchParams.get('metadata_url')).toBe(validOptions.metadataUrl)
    expect(parsed.searchParams.get('success_url')).toBe(validOptions.successUrl)
    expect(parsed.searchParams.get('cancel_url')).toBe(validOptions.cancelUrl)
    expect(parsed.searchParams.get('spending_cap')).toBeNull()
  })

  it('includes spending cap when provided', () => {
    const url = createCheckoutUrl({ ...validOptions, spendingCap: 119.88 })
    const parsed = new URL(url)
    expect(parsed.searchParams.get('spending_cap')).toBe('119.88')
  })

  it('uses custom base URL', () => {
    const url = createCheckoutUrl({ ...validOptions, baseUrl: 'https://staging.autopay.xyz' })
    expect(url.startsWith('https://staging.autopay.xyz/checkout')).toBe(true)
  })

  it('accepts numeric interval (seconds)', () => {
    const url = createCheckoutUrl({ ...validOptions, interval: 86400 })
    const parsed = new URL(url)
    expect(parsed.searchParams.get('interval')).toBe('86400')
  })

  it('throws on invalid merchant address', () => {
    expect(() => createCheckoutUrl({ ...validOptions, merchant: 'not-an-address' }))
      .toThrow(AutoPayCheckoutError)
  })

  it('throws on invalid amount', () => {
    expect(() => createCheckoutUrl({ ...validOptions, amount: -1 }))
      .toThrow(AutoPayCheckoutError)
    expect(() => createCheckoutUrl({ ...validOptions, amount: 0 }))
      .toThrow(AutoPayCheckoutError)
  })

  it('throws on interval out of range', () => {
    expect(() => createCheckoutUrl({ ...validOptions, interval: 10 }))
      .toThrow(AutoPayCheckoutError)
    expect(() => createCheckoutUrl({ ...validOptions, interval: 365 * 86400 + 1 }))
      .toThrow(AutoPayCheckoutError)
  })

  it('throws on invalid URLs', () => {
    expect(() => createCheckoutUrl({ ...validOptions, metadataUrl: 'not-a-url' }))
      .toThrow(AutoPayCheckoutError)
    expect(() => createCheckoutUrl({ ...validOptions, successUrl: 'not-a-url' }))
      .toThrow(AutoPayCheckoutError)
    expect(() => createCheckoutUrl({ ...validOptions, cancelUrl: 'not-a-url' }))
      .toThrow(AutoPayCheckoutError)
  })

  it('throws when spending cap < amount', () => {
    expect(() => createCheckoutUrl({ ...validOptions, spendingCap: 5 }))
      .toThrow(AutoPayCheckoutError)
  })
})

describe('parseSuccessRedirect', () => {
  it('parses policy_id and tx_hash from query string', () => {
    const qs = '?policy_id=0xabc123&tx_hash=0xdef456'
    const result = parseSuccessRedirect(qs)
    expect(result.policyId).toBe('0xabc123')
    expect(result.txHash).toBe('0xdef456')
  })

  it('throws on missing policy_id', () => {
    expect(() => parseSuccessRedirect('?tx_hash=0xdef456'))
      .toThrow(AutoPayCheckoutError)
  })

  it('throws on missing tx_hash', () => {
    expect(() => parseSuccessRedirect('?policy_id=0xabc123'))
      .toThrow(AutoPayCheckoutError)
  })
})

// ---------------------------------------------------------------------------
// Plan-based checkout tests
// ---------------------------------------------------------------------------

const MERCHANT = '0x2B8b9182c1c3A9bEf4a60951D9B7F49420D12B9B'
const RELAYER = 'https://relayer.example.com'

const activePlanResponse = {
  id: 'pro',
  merchantAddress: MERCHANT,
  metadata: {
    version: '1.0',
    plan: { name: 'Pro Plan', description: 'The best plan' },
    merchant: { name: 'Acme' },
    billing: { amount: '9.99', currency: 'USDC', interval: 'monthly', cap: '119.88' },
  },
  status: 'active',
  amount: 9.99,
  intervalLabel: 'monthly',
  spendingCap: 119.88,
  ipfsCid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
  ipfsMetadataUrl: 'https://w3s.link/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

function mockFetch(response: object, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
  })
}

describe('resolvePlan', () => {
  const baseOpts = {
    relayerUrl: RELAYER,
    merchant: MERCHANT,
    planId: 'pro',
    successUrl: 'https://mysite.com/success',
    cancelUrl: 'https://mysite.com/cancel',
  }

  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('resolves an active plan with IPFS URL', async () => {
    globalThis.fetch = mockFetch(activePlanResponse) as any
    const plan = await resolvePlan(baseOpts)

    expect(plan.amount).toBe(9.99)
    expect(plan.intervalSeconds).toBe(2_592_000)
    expect(plan.spendingCap).toBe(119.88)
    expect(plan.ipfsMetadataUrl).toBe(activePlanResponse.ipfsMetadataUrl)
    expect(plan.relayerMetadataUrl).toBe(`${RELAYER}/metadata/${MERCHANT}/pro`)
  })

  it('returns null ipfsMetadataUrl when no CID', async () => {
    globalThis.fetch = mockFetch({ ...activePlanResponse, ipfsCid: null, ipfsMetadataUrl: null }) as any
    const plan = await resolvePlan(baseOpts)

    expect(plan.ipfsMetadataUrl).toBeNull()
    expect(plan.relayerMetadataUrl).toBe(`${RELAYER}/metadata/${MERCHANT}/pro`)
  })

  it('throws on inactive plan', async () => {
    globalThis.fetch = mockFetch({ ...activePlanResponse, status: 'draft' }) as any
    await expect(resolvePlan(baseOpts)).rejects.toThrow('not active')
  })

  it('throws on missing billing', async () => {
    const noBilling = { ...activePlanResponse, metadata: { ...activePlanResponse.metadata, billing: undefined } }
    globalThis.fetch = mockFetch(noBilling) as any
    await expect(resolvePlan(baseOpts)).rejects.toThrow('missing billing')
  })

  it('throws on 404', async () => {
    globalThis.fetch = mockFetch({}, 404) as any
    await expect(resolvePlan(baseOpts)).rejects.toThrow('not found')
  })

  it('passes API key header when provided', async () => {
    const fetchMock = mockFetch(activePlanResponse) as any
    globalThis.fetch = fetchMock
    await resolvePlan({ ...baseOpts, apiKey: 'sk_test_123' })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { 'X-API-Key': 'sk_test_123' } }),
    )
  })

  it('throws on invalid merchant address', async () => {
    await expect(resolvePlan({ ...baseOpts, merchant: 'bad' })).rejects.toThrow('Invalid merchant')
  })

  it('throws on missing relayerUrl', async () => {
    await expect(resolvePlan({ ...baseOpts, relayerUrl: '' })).rejects.toThrow('relayerUrl')
  })

  it('wraps network errors as AutoPayCheckoutError', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed')) as any
    await expect(resolvePlan(baseOpts)).rejects.toThrow('Relayer request failed')
  })

  it('handles numeric interval strings from relayer API', async () => {
    const numericIntervalPlan = {
      ...activePlanResponse,
      metadata: {
        ...activePlanResponse.metadata,
        billing: { ...activePlanResponse.metadata.billing, interval: '2592000' },
      },
    }
    globalThis.fetch = mockFetch(numericIntervalPlan) as any
    const plan = await resolvePlan(baseOpts)

    expect(plan.intervalSeconds).toBe(2_592_000)
  })
})

describe('createCheckoutUrlFromPlan', () => {
  const baseOpts = {
    relayerUrl: RELAYER,
    merchant: MERCHANT,
    planId: 'pro',
    successUrl: 'https://mysite.com/success',
    cancelUrl: 'https://mysite.com/cancel',
  }

  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('uses relayer URL as primary metadata_url with IPFS as fallback', async () => {
    globalThis.fetch = mockFetch(activePlanResponse) as any
    const url = await createCheckoutUrlFromPlan(baseOpts)
    const parsed = new URL(url)

    // Primary metadata_url is always the relayer
    expect(parsed.searchParams.get('metadata_url')).toBe(`${RELAYER}/metadata/${MERCHANT}/pro`)
    // IPFS URL is passed as fallback param
    expect(parsed.searchParams.get('ipfs_metadata_url')).toBe(activePlanResponse.ipfsMetadataUrl)
    expect(parsed.searchParams.get('amount')).toBe('9.99')
    expect(parsed.searchParams.get('interval')).toBe('2592000')
    expect(parsed.searchParams.get('spending_cap')).toBe('119.88')
    expect(parsed.searchParams.get('merchant')).toBe(MERCHANT)
  })

  it('omits ipfs_metadata_url when no CID', async () => {
    globalThis.fetch = mockFetch({ ...activePlanResponse, ipfsCid: null, ipfsMetadataUrl: null }) as any
    const url = await createCheckoutUrlFromPlan(baseOpts)
    const parsed = new URL(url)

    expect(parsed.searchParams.get('metadata_url')).toBe(`${RELAYER}/metadata/${MERCHANT}/pro`)
    expect(parsed.searchParams.get('ipfs_metadata_url')).toBeNull()
  })

  it('spending cap override takes precedence over plan cap', async () => {
    globalThis.fetch = mockFetch(activePlanResponse) as any
    const url = await createCheckoutUrlFromPlan({ ...baseOpts, spendingCap: 500 })
    const parsed = new URL(url)

    expect(parsed.searchParams.get('spending_cap')).toBe('500')
  })

  it('uses custom baseUrl', async () => {
    globalThis.fetch = mockFetch(activePlanResponse) as any
    const url = await createCheckoutUrlFromPlan({ ...baseOpts, baseUrl: 'https://staging.autopay.xyz' })
    expect(url.startsWith('https://staging.autopay.xyz/checkout')).toBe(true)
  })
})
