import { describe, it, expect, vi, beforeEach } from 'vitest'
import { wrapFetchWithSubscription } from '../fetch'
import { MemoryStore } from '../store'
import type { AutoPayAgent } from '../agent'

// ── Mock agent ──────────────────────────────────────────────────

function createMockAgent(overrides: Partial<AutoPayAgent> = {}) {
  return {
    address: '0xAgentAddress' as `0x${string}`,
    chain: {
      chainId: 8453,
      name: 'Base',
      rpcUrl: 'https://mainnet.base.org',
      policyManager: '0xPM' as `0x${string}`,
      usdc: '0xUSDC' as `0x${string}`,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      explorer: 'https://basescan.org',
    },
    subscribe: vi.fn().mockResolvedValue({
      policyId: '0xpolicy123' as `0x${string}`,
      txHash: '0xtx123' as `0x${string}`,
    }),
    createBearerToken: vi.fn().mockResolvedValue('0xpolicy123.9999999999.0xsig'),
    getBalance: vi.fn().mockResolvedValue(100_000_000n), // 100 USDC
    getGasBalance: vi.fn().mockResolvedValue(1_000_000_000_000_000_000n), // 1 ETH
    bridgeUsdc: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as AutoPayAgent
}

// ── Helpers ─────────────────────────────────────────────────────

function make402Response(discovery: object) {
  return new Response(JSON.stringify({ autopay: discovery }), {
    status: 402,
    headers: { 'content-type': 'application/json' },
  })
}

function make200Response(body = { data: 'ok' }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

const DISCOVERY = {
  type: 'subscription',
  merchant: '0xMerchant' as `0x${string}`,
  plans: [
    { name: 'Basic', amount: '10', currency: 'USDC', interval: 2592000 },
  ],
  networks: [
    { chainId: 8453, name: 'Base', policyManager: '0xPM', usdc: '0xUSDC' },
  ],
}

// ── Tests ───────────────────────────────────────────────────────

describe('wrapFetchWithSubscription', () => {
  let agent: AutoPayAgent

  beforeEach(() => {
    agent = createMockAgent()
  })

  it('passes through non-402 responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue(make200Response())
    const wrappedFetch = wrapFetchWithSubscription(mockFetch, agent)

    const res = await wrappedFetch('https://api.example.com/data')
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    // Agent should not have been called
    expect(agent.subscribe).not.toHaveBeenCalled()
  })

  it('passes through requests that already have Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue(make200Response())
    const wrappedFetch = wrapFetchWithSubscription(mockFetch, agent)

    await wrappedFetch('https://api.example.com/data', {
      headers: { authorization: 'Bearer existing-token' },
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('subscribes on 402 with autopay discovery and retries', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(make402Response(DISCOVERY))
      .mockResolvedValueOnce(make200Response({ subscribed: true }))

    const wrappedFetch = wrapFetchWithSubscription(mockFetch, agent)
    const res = await wrappedFetch('https://api.example.com/data')

    expect(res.status).toBe(200)
    expect(agent.subscribe).toHaveBeenCalledWith({
      merchant: '0xMerchant',
      amount: 10,
      interval: 2592000,
      spendingCap: 300, // default: amount * 30
      metadataUrl: undefined,
    })

    // Second call should have Bearer header
    const secondCall = mockFetch.mock.calls[1]
    const headers = new Headers(secondCall[1]?.headers as HeadersInit)
    expect(headers.get('authorization')).toContain('Bearer')
  })

  it('returns 402 if body is not autopay discovery', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'pay up' }), { status: 402 }),
    )
    const wrappedFetch = wrapFetchWithSubscription(mockFetch, agent)

    const res = await wrappedFetch('https://api.example.com/data')
    expect(res.status).toBe(402)
    expect(agent.subscribe).not.toHaveBeenCalled()
  })

  it('reuses cached subscription on subsequent 402s', async () => {
    const store = new MemoryStore()
    const onReuse = vi.fn()

    const mockFetch = vi.fn()
      // First request: 402 → subscribe → retry succeeds
      .mockResolvedValueOnce(make402Response(DISCOVERY))
      .mockResolvedValueOnce(make200Response())
      // Second request: 402 → cached → retry succeeds
      .mockResolvedValueOnce(make402Response(DISCOVERY))
      .mockResolvedValueOnce(make200Response())

    const wrappedFetch = wrapFetchWithSubscription(mockFetch, agent, {
      store,
      onReuse,
    })

    await wrappedFetch('https://api.example.com/data')
    await wrappedFetch('https://api.example.com/data')

    // Subscribe called only once
    expect(agent.subscribe).toHaveBeenCalledTimes(1)
    expect(onReuse).toHaveBeenCalledTimes(1)
  })

  it('calls onSubscribe callback', async () => {
    const onSubscribe = vi.fn()
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(make402Response(DISCOVERY))
      .mockResolvedValueOnce(make200Response())

    const wrappedFetch = wrapFetchWithSubscription(mockFetch, agent, { onSubscribe })
    await wrappedFetch('https://api.example.com/data')

    expect(onSubscribe).toHaveBeenCalledWith('0xMerchant', {
      policyId: '0xpolicy123',
      txHash: '0xtx123',
    })
  })

  it('uses custom selectPlan', async () => {
    const discoveryTwoPlans = {
      ...DISCOVERY,
      plans: [
        { name: 'Basic', amount: '10', currency: 'USDC', interval: 2592000 },
        { name: 'Pro', amount: '50', currency: 'USDC', interval: 2592000 },
      ],
    }

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(make402Response(discoveryTwoPlans))
      .mockResolvedValueOnce(make200Response())

    const wrappedFetch = wrapFetchWithSubscription(mockFetch, agent, {
      selectPlan: (plans) => 1, // Select "Pro"
    })

    await wrappedFetch('https://api.example.com/data')
    expect(agent.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50 }),
    )
  })

  it('uses custom spendingCap', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(make402Response(DISCOVERY))
      .mockResolvedValueOnce(make200Response())

    const wrappedFetch = wrapFetchWithSubscription(mockFetch, agent, {
      spendingCap: (amount) => amount * 12, // 1 year cap
    })

    await wrappedFetch('https://api.example.com/data')
    expect(agent.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ spendingCap: 120 }),
    )
  })

  it('clears stale cached subscription when retry returns 402', async () => {
    const store = new MemoryStore()
    // Pre-populate with a stale subscription
    await store.set('0xmerchant', { policyId: '0xstale' as `0x${string}` })

    const mockFetch = vi.fn()
      // First request: 402
      .mockResolvedValueOnce(make402Response(DISCOVERY))
      // Retry with stale token: still 402
      .mockResolvedValueOnce(make402Response(DISCOVERY))
      // After new subscribe: success
      .mockResolvedValueOnce(make200Response())

    const wrappedFetch = wrapFetchWithSubscription(mockFetch, agent, { store })
    await wrappedFetch('https://api.example.com/data')

    // Should have subscribed with new policy
    expect(agent.subscribe).toHaveBeenCalledTimes(1)
  })
})
