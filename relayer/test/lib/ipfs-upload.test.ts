import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PlanMetadata } from '../../src/db/metadata.js'

// Mock storacha module
vi.mock('../../src/lib/storacha.js', () => ({
  isStorachaEnabled: vi.fn(),
  uploadJSON: vi.fn(),
}))

// Mock DB metadata module
vi.mock('../../src/db/metadata.js', () => ({
  setPlanIpfsCid: vi.fn(),
}))

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}))

const sampleMetadata: PlanMetadata = {
  version: '1.0',
  plan: { name: 'Pro Plan', description: 'Premium features' },
  merchant: { name: 'TestCo' },
  billing: { amount: '10', currency: 'USDC', interval: 'monthly', cap: '120' },
}

describe('uploadPlanToIPFS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when Storacha is not configured', async () => {
    const { isStorachaEnabled } = await import('../../src/lib/storacha.js')
    const { setPlanIpfsCid } = await import('../../src/db/metadata.js')
    const { uploadPlanToIPFS } = await import('../../src/lib/ipfs-upload.js')

    vi.mocked(isStorachaEnabled).mockReturnValue(false)

    await expect(
      uploadPlanToIPFS('postgres://test', 'plan-1', '0x1234567890abcdef1234567890abcdef12345678', sampleMetadata)
    ).rejects.toThrow('Storacha is not configured')
    expect(setPlanIpfsCid).not.toHaveBeenCalled()
  })

  it('uploads metadata and returns CID on success', async () => {
    const { isStorachaEnabled, uploadJSON } = await import('../../src/lib/storacha.js')
    const { setPlanIpfsCid } = await import('../../src/db/metadata.js')
    const { uploadPlanToIPFS } = await import('../../src/lib/ipfs-upload.js')

    vi.mocked(isStorachaEnabled).mockReturnValue(true)
    vi.mocked(uploadJSON).mockResolvedValue('bafybeimockCID456')
    vi.mocked(setPlanIpfsCid).mockResolvedValue(undefined)

    const result = await uploadPlanToIPFS('postgres://test', 'plan-1', '0x1234567890abcdef1234567890abcdef12345678', sampleMetadata)

    expect(result).toBe('bafybeimockCID456')
    expect(uploadJSON).toHaveBeenCalled()
    expect(setPlanIpfsCid).toHaveBeenCalledWith('postgres://test', 'plan-1', '0x1234567890abcdef1234567890abcdef12345678', 'bafybeimockCID456')
  })

  it('throws when uploadJSON fails', async () => {
    const { isStorachaEnabled, uploadJSON } = await import('../../src/lib/storacha.js')
    const { setPlanIpfsCid } = await import('../../src/db/metadata.js')
    const { uploadPlanToIPFS } = await import('../../src/lib/ipfs-upload.js')

    vi.mocked(isStorachaEnabled).mockReturnValue(true)
    vi.mocked(uploadJSON).mockRejectedValue(new Error('Network error'))

    await expect(
      uploadPlanToIPFS('postgres://test', 'plan-1', '0x1234567890abcdef1234567890abcdef12345678', sampleMetadata)
    ).rejects.toThrow('Network error')
    expect(setPlanIpfsCid).not.toHaveBeenCalled()
  })

  it('throws when setPlanIpfsCid fails', async () => {
    const { isStorachaEnabled, uploadJSON } = await import('../../src/lib/storacha.js')
    const { setPlanIpfsCid } = await import('../../src/db/metadata.js')
    const { uploadPlanToIPFS } = await import('../../src/lib/ipfs-upload.js')

    vi.mocked(isStorachaEnabled).mockReturnValue(true)
    vi.mocked(uploadJSON).mockResolvedValue('bafybeimockCID789')
    vi.mocked(setPlanIpfsCid).mockRejectedValue(new Error('DB connection failed'))

    await expect(
      uploadPlanToIPFS('postgres://test', 'plan-1', '0x1234567890abcdef1234567890abcdef12345678', sampleMetadata)
    ).rejects.toThrow('DB connection failed')
  })

  it('resolves relative logo via logoResolver before upload', async () => {
    const { isStorachaEnabled, uploadJSON } = await import('../../src/lib/storacha.js')
    const { setPlanIpfsCid } = await import('../../src/db/metadata.js')
    const { uploadPlanToIPFS } = await import('../../src/lib/ipfs-upload.js')

    vi.mocked(isStorachaEnabled).mockReturnValue(true)
    vi.mocked(uploadJSON).mockResolvedValue('bafyLogo')
    vi.mocked(setPlanIpfsCid).mockResolvedValue(undefined)

    const metaWithLogo: PlanMetadata = {
      ...sampleMetadata,
      merchant: { name: 'TestCo', logo: 'abc123.png' },
    }

    const resolver = vi.fn().mockReturnValue('https://storage.example.com/logos/abc123.png')

    await uploadPlanToIPFS('postgres://test', 'plan-1', '0xabc', metaWithLogo, resolver)

    expect(resolver).toHaveBeenCalledWith('abc123.png')
    // Verify the uploaded metadata has the resolved absolute URL
    const uploadedData = vi.mocked(uploadJSON).mock.calls[0][0] as PlanMetadata
    expect(uploadedData.merchant?.logo).toBe('https://storage.example.com/logos/abc123.png')
    // Original should not be mutated
    expect(metaWithLogo.merchant?.logo).toBe('abc123.png')
  })

  it('skips logo resolution for absolute URLs', async () => {
    const { isStorachaEnabled, uploadJSON } = await import('../../src/lib/storacha.js')
    const { setPlanIpfsCid } = await import('../../src/db/metadata.js')
    const { uploadPlanToIPFS } = await import('../../src/lib/ipfs-upload.js')

    vi.mocked(isStorachaEnabled).mockReturnValue(true)
    vi.mocked(uploadJSON).mockResolvedValue('bafyAbsolute')
    vi.mocked(setPlanIpfsCid).mockResolvedValue(undefined)

    const metaWithAbsoluteLogo: PlanMetadata = {
      ...sampleMetadata,
      merchant: { name: 'TestCo', logo: 'https://cdn.example.com/logo.png' },
    }

    const resolver = vi.fn()

    await uploadPlanToIPFS('postgres://test', 'plan-1', '0xabc', metaWithAbsoluteLogo, resolver)

    expect(resolver).not.toHaveBeenCalled()
  })
})
