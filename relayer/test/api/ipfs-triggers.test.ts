import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import type { Server } from 'http'

// --- Mocks (must be before any imports of the module under test) ---

const mockUploadPlanToIPFS = vi.fn().mockResolvedValue('bafyMockCID')
vi.mock('../../src/lib/ipfs-upload.js', () => ({
  uploadPlanToIPFS: (...args: unknown[]) => mockUploadPlanToIPFS(...args),
}))

// Mock storacha module — isStorachaEnabled returns true so IPFS branch is exercised
const mockIsStorachaEnabled = vi.fn().mockReturnValue(true)
vi.mock('../../src/lib/storacha.js', () => ({
  isStorachaEnabled: (...args: unknown[]) => mockIsStorachaEnabled(...args),
  ipfsGatewayUrl: (cid: string) => `https://w3s.link/ipfs/${cid}`,
}))

// Mock DB functions
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

vi.mock('../../src/db/whitelist.js', () => ({
  isWhitelisted: vi.fn().mockResolvedValue(true),
  getWhitelist: vi.fn().mockResolvedValue([]),
  addToWhitelist: vi.fn().mockResolvedValue({ address: '', note: null, created_at: '' }),
  removeFromWhitelist: vi.fn().mockResolvedValue(true),
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

const MERCHANT = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28'

function basePlan(overrides: Record<string, unknown> = {}) {
  return {
    version: '1.0',
    plan: { name: 'Test', description: 'A test plan' },
    merchant: { name: 'TestCo' },
    billing: { amount: '5', currency: 'USDC', interval: 'monthly', cap: '60' },
    ...overrides,
  }
}

function existingPlanRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'existing-plan',
    merchant_address: MERCHANT.toLowerCase(),
    metadata: basePlan(),
    status: 'active',
    ipfs_cid: null,
    amount: '5',
    interval_label: 'monthly',
    spending_cap: '60',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

async function request(server: Server, method: string, path: string, body?: unknown): Promise<{ status: number; body: unknown }> {
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Server not started')

  const url = `http://localhost:${address.port}${path}`
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { parsed = text }

  return { status: res.status, body: parsed }
}

describe('API IPFS upload triggers', () => {
  let server: Server

  beforeAll(async () => {
    const { createApiServer } = await import('../../src/api/index.js')
    server = await createApiServer({ databaseUrl: 'postgres://test', chains: {} } as any)
    await new Promise<void>((resolve) => server.listen(0, resolve))
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockInsertPlanMetadata.mockResolvedValue(true)
    mockUploadPlanToIPFS.mockResolvedValue('bafyMockCID')
    mockIsStorachaEnabled.mockReturnValue(true)
  })

  // ==================== CREATE ====================

  it('POST create with status=active triggers blocking IPFS upload', async () => {
    const res = await request(server, 'POST', `/merchants/${MERCHANT}/plans`, {
      id: 'new-active',
      status: 'active',
      ...basePlan(),
    })

    expect(res.status).toBe(201)
    expect(mockUploadPlanToIPFS).toHaveBeenCalledTimes(1)
    expect(mockUploadPlanToIPFS).toHaveBeenCalledWith(
      'postgres://test',
      'new-active',
      MERCHANT,
      expect.objectContaining({ plan: { name: 'Test', description: 'A test plan' } }),
      expect.any(Function), // logoResolver
    )
    // Plan should be inserted as draft first, then promoted
    expect(mockInsertPlanMetadata).toHaveBeenCalledWith(
      'postgres://test', 'new-active', MERCHANT,
      expect.anything(), 'draft', // insertStatus = draft when needsIpfs
    )
    // After IPFS success, promoted to active
    expect(mockUpdatePlanMetadata).toHaveBeenCalledWith(
      'postgres://test', 'new-active', MERCHANT,
      expect.anything(), 'active',
    )
    // Response includes CID and computed IPFS gateway URL
    expect((res.body as any).ipfsCid).toBe('bafyMockCID')
    expect((res.body as any).ipfsMetadataUrl).toBe('https://w3s.link/ipfs/bafyMockCID')
    expect((res.body as any).status).toBe('active')
  })

  it('POST create with status=draft does NOT trigger IPFS upload', async () => {
    const res = await request(server, 'POST', `/merchants/${MERCHANT}/plans`, {
      id: 'new-draft',
      status: 'draft',
      ...basePlan(),
    })

    expect(res.status).toBe(201)
    expect(mockUploadPlanToIPFS).not.toHaveBeenCalled()
  })

  it('POST create defaults to active and triggers upload', async () => {
    const res = await request(server, 'POST', `/merchants/${MERCHANT}/plans`, {
      id: 'default-active',
      ...basePlan(),
    })

    expect(res.status).toBe(201)
    expect(mockUploadPlanToIPFS).toHaveBeenCalledTimes(1)
  })

  it('POST create inserts directly as active when Storacha is disabled', async () => {
    mockIsStorachaEnabled.mockReturnValue(false)

    const res = await request(server, 'POST', `/merchants/${MERCHANT}/plans`, {
      id: 'no-ipfs',
      status: 'active',
      ...basePlan(),
    })

    expect(res.status).toBe(201)
    expect(mockUploadPlanToIPFS).not.toHaveBeenCalled()
    // Inserted directly as active (no draft→active promotion)
    expect(mockInsertPlanMetadata).toHaveBeenCalledWith(
      'postgres://test', 'no-ipfs', MERCHANT,
      expect.anything(), 'active',
    )
    expect(mockUpdatePlanMetadata).not.toHaveBeenCalled()
  })

  // ==================== PUT (full update) ====================

  it('PUT transitioning draft -> active triggers IPFS upload', async () => {
    mockGetPlanMetadata.mockResolvedValue(existingPlanRow({ status: 'draft', ipfs_cid: null }))

    const res = await request(server, 'PUT', `/merchants/${MERCHANT}/plans/existing-plan`, {
      status: 'active',
      ...basePlan(),
    })

    expect(res.status).toBe(200)
    expect(mockUploadPlanToIPFS).toHaveBeenCalledTimes(1)
    expect((res.body as any).status).toBe('active')
  })

  it('PUT on already-active plan WITH existing CID re-uploads when content changes', async () => {
    mockGetPlanMetadata.mockResolvedValue(existingPlanRow({ status: 'active', ipfs_cid: 'bafyExisting' }))

    const res = await request(server, 'PUT', `/merchants/${MERCHANT}/plans/existing-plan`, {
      ...basePlan({ plan: { name: 'Updated Name', description: 'Updated' } }),
    })

    expect(res.status).toBe(200)
    expect(mockUploadPlanToIPFS).toHaveBeenCalledTimes(1)
    expect((res.body as any).ipfsCid).toBe('bafyMockCID')
    expect((res.body as any).ipfsMetadataUrl).toBe('https://w3s.link/ipfs/bafyMockCID')
  })

  it('PUT on already-active plan WITH existing CID does NOT re-upload when content is unchanged', async () => {
    mockGetPlanMetadata.mockResolvedValue(existingPlanRow({ status: 'active', ipfs_cid: 'bafyExisting' }))

    const res = await request(server, 'PUT', `/merchants/${MERCHANT}/plans/existing-plan`, {
      ...basePlan(), // same content as existingPlanRow metadata
    })

    expect(res.status).toBe(200)
    expect(mockUploadPlanToIPFS).not.toHaveBeenCalled()
  })

  it('PUT transitioning archived -> active triggers IPFS upload', async () => {
    mockGetPlanMetadata.mockResolvedValue(existingPlanRow({ status: 'archived', ipfs_cid: null }))

    const res = await request(server, 'PUT', `/merchants/${MERCHANT}/plans/existing-plan`, {
      status: 'active',
      ...basePlan(),
    })

    expect(res.status).toBe(200)
    expect(mockUploadPlanToIPFS).toHaveBeenCalledTimes(1)
    expect((res.body as any).status).toBe('active')
    expect((res.body as any).ipfsMetadataUrl).toBe('https://w3s.link/ipfs/bafyMockCID')
  })

  it('PUT draft -> active with existing CID skips re-upload and just promotes', async () => {
    mockGetPlanMetadata.mockResolvedValue(existingPlanRow({ status: 'draft', ipfs_cid: 'bafyPriorCID' }))

    const res = await request(server, 'PUT', `/merchants/${MERCHANT}/plans/existing-plan`, {
      status: 'active',
      ...basePlan(),
    })

    expect(res.status).toBe(200)
    expect(mockUploadPlanToIPFS).not.toHaveBeenCalled()
    // Should promote to active without re-uploading
    expect((res.body as any).status).toBe('active')
  })

  it('PUT on already-active plan WITHOUT CID triggers upload', async () => {
    mockGetPlanMetadata.mockResolvedValue(existingPlanRow({ status: 'active', ipfs_cid: null }))

    const res = await request(server, 'PUT', `/merchants/${MERCHANT}/plans/existing-plan`, {
      ...basePlan(),
    })

    expect(res.status).toBe(200)
    expect(mockUploadPlanToIPFS).toHaveBeenCalledTimes(1)
  })

  // ==================== PATCH ====================

  it('PATCH transitioning draft -> active triggers IPFS upload', async () => {
    mockGetPlanMetadata.mockResolvedValue(existingPlanRow({ status: 'draft', ipfs_cid: null }))

    const res = await request(server, 'PATCH', `/merchants/${MERCHANT}/plans/existing-plan`, {
      status: 'active',
    })

    expect(res.status).toBe(200)
    expect(mockUploadPlanToIPFS).toHaveBeenCalledTimes(1)
  })

  it('PATCH transitioning archived -> active triggers IPFS upload', async () => {
    mockGetPlanMetadata.mockResolvedValue(existingPlanRow({ status: 'archived', ipfs_cid: null }))

    const res = await request(server, 'PATCH', `/merchants/${MERCHANT}/plans/existing-plan`, {
      status: 'active',
    })

    expect(res.status).toBe(200)
    expect(mockUploadPlanToIPFS).toHaveBeenCalledTimes(1)
    expect((res.body as any).status).toBe('active')
    expect((res.body as any).ipfsMetadataUrl).toBe('https://w3s.link/ipfs/bafyMockCID')
  })

  it('PATCH draft -> active with existing CID skips re-upload and just promotes', async () => {
    mockGetPlanMetadata.mockResolvedValue(existingPlanRow({ status: 'draft', ipfs_cid: 'bafyPriorCID' }))

    const res = await request(server, 'PATCH', `/merchants/${MERCHANT}/plans/existing-plan`, {
      status: 'active',
    })

    expect(res.status).toBe(200)
    expect(mockUploadPlanToIPFS).not.toHaveBeenCalled()
    expect((res.body as any).status).toBe('active')
  })

  it('PATCH on active plan WITH existing CID re-uploads when content changes', async () => {
    mockGetPlanMetadata.mockResolvedValue(existingPlanRow({ status: 'active', ipfs_cid: 'bafyExisting' }))

    const res = await request(server, 'PATCH', `/merchants/${MERCHANT}/plans/existing-plan`, {
      plan: { name: 'Renamed' },
    })

    expect(res.status).toBe(200)
    expect(mockUploadPlanToIPFS).toHaveBeenCalledTimes(1)
    expect((res.body as any).ipfsCid).toBe('bafyMockCID')
  })

  it('PATCH on active plan WITH existing CID does NOT re-upload for status-only change', async () => {
    // PATCH with no content changes (just setting status to same value)
    mockGetPlanMetadata.mockResolvedValue(existingPlanRow({ status: 'active', ipfs_cid: 'bafyExisting' }))

    const res = await request(server, 'PATCH', `/merchants/${MERCHANT}/plans/existing-plan`, {
      status: 'active', // no content change
    })

    expect(res.status).toBe(200)
    expect(mockUploadPlanToIPFS).not.toHaveBeenCalled()
  })

  it('PATCH on active plan WITHOUT CID triggers upload', async () => {
    mockGetPlanMetadata.mockResolvedValue(existingPlanRow({ status: 'active', ipfs_cid: null }))

    const res = await request(server, 'PATCH', `/merchants/${MERCHANT}/plans/existing-plan`, {
      plan: { name: 'Renamed' },
    })

    expect(res.status).toBe(200)
    expect(mockUploadPlanToIPFS).toHaveBeenCalledTimes(1)
  })

  it('PATCH archiving an active plan does NOT trigger upload', async () => {
    mockGetPlanMetadata.mockResolvedValue(existingPlanRow({ status: 'active', ipfs_cid: null }))

    const res = await request(server, 'PATCH', `/merchants/${MERCHANT}/plans/existing-plan`, {
      status: 'archived',
    })

    expect(res.status).toBe(200)
    expect(mockUploadPlanToIPFS).not.toHaveBeenCalled()
  })

  // ==================== Error handling ====================

  it('IPFS upload failure returns 503 and plan stays as draft', async () => {
    mockUploadPlanToIPFS.mockRejectedValue(new Error('Storacha down'))

    const res = await request(server, 'POST', `/merchants/${MERCHANT}/plans`, {
      id: 'fail-test',
      status: 'active',
      ...basePlan(),
    })

    expect(res.status).toBe(503)
    expect((res.body as any).error).toMatch(/IPFS upload failed/)
    // Plan was inserted as draft and stays as draft (no promotion)
    expect(mockInsertPlanMetadata).toHaveBeenCalledWith(
      expect.anything(), 'fail-test', MERCHANT,
      expect.anything(), 'draft',
    )
    expect(mockUpdatePlanMetadata).not.toHaveBeenCalled()
  })

  it('IPFS upload failure on PATCH returns 503 and status stays unchanged', async () => {
    mockGetPlanMetadata.mockResolvedValue(existingPlanRow({ status: 'draft', ipfs_cid: null }))
    mockUploadPlanToIPFS.mockRejectedValue(new Error('Storacha down'))

    const res = await request(server, 'PATCH', `/merchants/${MERCHANT}/plans/existing-plan`, {
      status: 'active',
    })

    expect(res.status).toBe(503)
    expect((res.body as any).status).toBe('draft')
  })
})
