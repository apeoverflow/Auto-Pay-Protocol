import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { Server } from 'http'
import { privateKeyToAccount } from 'viem/accounts'

// --- Mocks (must be before imports of module under test) ---

const mockUploadPlanToIPFS = vi.fn().mockResolvedValue(true)
vi.mock('../../src/lib/ipfs-upload.js', () => ({
  uploadPlanToIPFS: (...args: unknown[]) => mockUploadPlanToIPFS(...args),
}))

const mockInsertPlanMetadata = vi.fn().mockResolvedValue(true)
const mockGetPlanMetadata = vi.fn()
const mockUpdatePlanMetadata = vi.fn().mockResolvedValue(true)
const mockGetPlanMetadataByMerchant = vi.fn().mockResolvedValue([])
const mockListAllPlanMetadata = vi.fn().mockResolvedValue([])
const mockDeletePlanMetadata = vi.fn().mockResolvedValue(true)

vi.mock('../../src/db/metadata.js', () => ({
  insertPlanMetadata: (...args: unknown[]) => mockInsertPlanMetadata(...args),
  getPlanMetadata: (...args: unknown[]) => mockGetPlanMetadata(...args),
  updatePlanMetadata: (...args: unknown[]) => mockUpdatePlanMetadata(...args),
  getPlanMetadataByMerchant: (...args: unknown[]) => mockGetPlanMetadataByMerchant(...args),
  listAllPlanMetadata: (...args: unknown[]) => mockListAllPlanMetadata(...args),
  deletePlanMetadata: (...args: unknown[]) => mockDeletePlanMetadata(...args),
}))

vi.mock('../../src/db/index.js', () => ({
  getStatus: vi.fn().mockResolvedValue({
    chains: {},
    webhooks: { pending: 0, failed: 0 },
  }),
}))

vi.mock('../../src/config.js', () => ({
  getEnabledChains: vi.fn().mockReturnValue([]),
  loadConfig: vi.fn().mockReturnValue({ databaseUrl: 'postgres://test', chains: {} }),
}))

vi.mock('../../src/utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}))

// Test account (Hardhat account #0 — never use in production)
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const
const testAccount = privateKeyToAccount(TEST_PRIVATE_KEY)
const MERCHANT = testAccount.address

function basePlan() {
  return {
    plan: { name: 'Test', description: 'A test plan' },
    merchant: { name: 'TestCo' },
    billing: { amount: '5', currency: 'USDC', interval: 'monthly', cap: '60' },
  }
}

async function request(
  server: Server,
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Server not started')

  const url = `http://localhost:${address.port}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = text
  }

  return { status: res.status, body: parsed, headers: res.headers }
}

describe('Auth integration — AUTH_ENABLED=false (default)', () => {
  let server: Server

  beforeAll(async () => {
    // Ensure AUTH_ENABLED is not set
    delete process.env.AUTH_ENABLED

    // Fresh import with AUTH_ENABLED=false
    const { createApiServer } = await import('../../src/api/index.js')
    server = await createApiServer({ databaseUrl: 'postgres://test', chains: {} } as any)
    await new Promise<void>((resolve) => server.listen(0, resolve))
  })

  afterAll(async () => {
    const { stopApiServer } = await import('../../src/api/index.js')
    await stopApiServer(server)
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockInsertPlanMetadata.mockResolvedValue(true)
  })

  it('POST creates plan without auth headers', async () => {
    const res = await request(server, 'POST', `/merchants/${MERCHANT}/plans`, {
      id: 'no-auth-test',
      ...basePlan(),
    })

    expect(res.status).toBe(201)
  })

  it('nonce endpoint is still available', async () => {
    const res = await request(server, 'GET', `/auth/nonce?address=${MERCHANT}`)
    expect(res.status).toBe(200)
    const body = res.body as { nonce: string; message: string }
    expect(body.nonce).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('Auth integration — AUTH_ENABLED=true', () => {
  let server: Server

  beforeAll(async () => {
    process.env.AUTH_ENABLED = 'true'

    // We need to re-import the module to pick up the new env var
    // Since vitest caches modules, we use dynamic import with cache busting
    vi.resetModules()

    // Re-apply mocks after resetModules
    vi.doMock('../../src/lib/ipfs-upload.js', () => ({
      uploadPlanToIPFS: (...args: unknown[]) => mockUploadPlanToIPFS(...args),
    }))
    vi.doMock('../../src/db/metadata.js', () => ({
      insertPlanMetadata: (...args: unknown[]) => mockInsertPlanMetadata(...args),
      getPlanMetadata: (...args: unknown[]) => mockGetPlanMetadata(...args),
      updatePlanMetadata: (...args: unknown[]) => mockUpdatePlanMetadata(...args),
      getPlanMetadataByMerchant: (...args: unknown[]) => mockGetPlanMetadataByMerchant(...args),
      listAllPlanMetadata: (...args: unknown[]) => mockListAllPlanMetadata(...args),
      deletePlanMetadata: (...args: unknown[]) => mockDeletePlanMetadata(...args),
    }))
    vi.doMock('../../src/db/index.js', () => ({
      getStatus: vi.fn().mockResolvedValue({
        chains: {},
        webhooks: { pending: 0, failed: 0 },
      }),
    }))
    vi.doMock('../../src/config.js', () => ({
      getEnabledChains: vi.fn().mockReturnValue([]),
      loadConfig: vi.fn().mockReturnValue({ databaseUrl: 'postgres://test', chains: {} }),
    }))
    vi.doMock('../../src/utils/logger.js', () => ({
      createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
      }),
    }))

    const { createApiServer } = await import('../../src/api/index.js')
    server = await createApiServer({ databaseUrl: 'postgres://test', chains: {} } as any)
    await new Promise<void>((resolve) => server.listen(0, resolve))
  })

  afterAll(async () => {
    const { stopApiServer } = await import('../../src/api/index.js')
    await stopApiServer(server)
    delete process.env.AUTH_ENABLED
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockInsertPlanMetadata.mockResolvedValue(true)
  })

  it('POST without auth headers returns 401', async () => {
    const res = await request(server, 'POST', `/merchants/${MERCHANT}/plans`, {
      id: 'auth-required',
      ...basePlan(),
    })

    expect(res.status).toBe(401)
  })

  it('full flow: nonce → sign → authenticated POST succeeds', async () => {
    // Step 1: Get nonce
    const nonceRes = await request(server, 'GET', `/auth/nonce?address=${MERCHANT}`)
    expect(nonceRes.status).toBe(200)
    const { nonce, message } = nonceRes.body as { nonce: string; message: string }

    // Step 2: Sign message
    const signature = await testAccount.signMessage({ message })

    // Step 3: Authenticated request
    const createRes = await request(
      server,
      'POST',
      `/merchants/${MERCHANT}/plans`,
      { id: 'auth-test', ...basePlan() },
      {
        'X-Address': MERCHANT,
        'X-Signature': signature,
        'X-Nonce': nonce,
      }
    )

    expect(createRes.status).toBe(201)
  })

  it('rate limiting: nonce requests are capped at 10/min per IP', async () => {
    // Note: previous tests in this suite may have already consumed some of the
    // rate limit quota (same IP: 127.0.0.1/::1). We send enough to guarantee
    // hitting the limit regardless of prior usage.
    const results: number[] = []

    for (let i = 0; i < 15; i++) {
      const res = await request(server, 'GET', `/auth/nonce?address=${MERCHANT}`)
      results.push(res.status)
    }

    const successes = results.filter((s) => s === 200).length
    const rateLimited = results.filter((s) => s === 429).length

    // Should have gotten some successes and some 429s
    expect(successes).toBeGreaterThan(0)
    expect(successes).toBeLessThanOrEqual(10)
    expect(rateLimited).toBeGreaterThan(0)

    // Last request should definitely be rate-limited
    expect(results[results.length - 1]).toBe(429)
  })

  it('GET requests are not affected by auth', async () => {
    const res = await request(server, 'GET', `/merchants/${MERCHANT}/plans`)
    expect(res.status).toBe(200)
  })
})
