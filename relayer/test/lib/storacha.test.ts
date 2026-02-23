import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Must mock before importing the module under test
vi.mock('@storacha/client', () => {
  const mockClient = {
    addSpace: vi.fn().mockResolvedValue({ did: () => 'did:key:z6Mock123' }),
    setCurrentSpace: vi.fn().mockResolvedValue(undefined),
    uploadFile: vi.fn().mockResolvedValue({ toString: () => 'bafybeimockCID123' }),
  }
  return {
    create: vi.fn().mockResolvedValue(mockClient),
    __mockClient: mockClient,
  }
})

vi.mock('@storacha/client/principal/ed25519', () => ({
  Signer: {
    parse: vi.fn().mockReturnValue({ did: () => 'did:key:z6MockSigner' }),
  },
}))

vi.mock('@storacha/client/proof', () => ({
  parse: vi.fn().mockResolvedValue({
    capabilities: [{ with: 'did:key:z6MockSpace' }],
  }),
}))

vi.mock('@storacha/client/stores/memory', () => ({
  StoreMemory: vi.fn(),
}))

describe('storacha', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Reset module-level singleton between tests
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('isStorachaEnabled', () => {
    it('returns false when env vars are missing', async () => {
      delete process.env.STORACHA_PRINCIPAL_KEY
      delete process.env.STORACHA_DELEGATION_PROOF

      const { isStorachaEnabled } = await import('../../src/lib/storacha.js')
      expect(isStorachaEnabled()).toBe(false)
    })

    it('returns false when only one env var is set', async () => {
      process.env.STORACHA_PRINCIPAL_KEY = 'test-key'
      delete process.env.STORACHA_DELEGATION_PROOF

      const { isStorachaEnabled } = await import('../../src/lib/storacha.js')
      expect(isStorachaEnabled()).toBe(false)
    })

    it('returns true when both env vars are set', async () => {
      process.env.STORACHA_PRINCIPAL_KEY = 'test-key'
      process.env.STORACHA_DELEGATION_PROOF = 'test-proof'

      const { isStorachaEnabled } = await import('../../src/lib/storacha.js')
      expect(isStorachaEnabled()).toBe(true)
    })
  })

  describe('getStorachaClient', () => {
    it('creates client with correct auth flow', async () => {
      process.env.STORACHA_PRINCIPAL_KEY = 'MgCZtest'
      process.env.STORACHA_DELEGATION_PROOF = 'gOGBtest'

      const { getStorachaClient } = await import('../../src/lib/storacha.js')
      const ClientMod = await import('@storacha/client')
      const { Signer } = await import('@storacha/client/principal/ed25519')
      const Proof = await import('@storacha/client/proof')

      const client = await getStorachaClient()

      // Verify auth sequence
      expect(Signer.parse).toHaveBeenCalledWith('MgCZtest')
      expect(ClientMod.create).toHaveBeenCalled()
      expect(Proof.parse).toHaveBeenCalledWith('gOGBtest')

      // Verify addSpace is called and its return value used for setCurrentSpace
      const mockClient = (ClientMod as any).__mockClient
      expect(mockClient.addSpace).toHaveBeenCalled()
      expect(mockClient.setCurrentSpace).toHaveBeenCalledWith('did:key:z6Mock123')

      expect(client).toBe(mockClient)
    })

    it('returns same client on second call (singleton)', async () => {
      process.env.STORACHA_PRINCIPAL_KEY = 'MgCZtest'
      process.env.STORACHA_DELEGATION_PROOF = 'gOGBtest'

      const { getStorachaClient } = await import('../../src/lib/storacha.js')

      const client1 = await getStorachaClient()
      const client2 = await getStorachaClient()

      expect(client1).toBe(client2)
    })
  })

  describe('uploadJSON', () => {
    it('serializes data and uploads via client.uploadFile', async () => {
      process.env.STORACHA_PRINCIPAL_KEY = 'MgCZtest'
      process.env.STORACHA_DELEGATION_PROOF = 'gOGBtest'

      const { uploadJSON } = await import('../../src/lib/storacha.js')

      const data = { plan: { name: 'Test Plan' }, version: '1.0' }
      const cid = await uploadJSON(data)

      expect(cid).toBe('bafybeimockCID123')

      // Verify uploadFile was called with a Blob
      const ClientMod = await import('@storacha/client')
      const mockClient = (ClientMod as any).__mockClient
      expect(mockClient.uploadFile).toHaveBeenCalledTimes(1)

      const blobArg = mockClient.uploadFile.mock.calls[0][0]
      expect(blobArg).toBeInstanceOf(Blob)
      expect(blobArg.type).toBe('application/json')

      // Verify the Blob content is the JSON-serialized data
      const text = await blobArg.text()
      expect(JSON.parse(text)).toEqual(data)
    })
  })
})
