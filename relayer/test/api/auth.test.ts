import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'http'
import { privateKeyToAccount } from 'viem/accounts'

// Mock logger before importing auth
vi.mock('../../src/utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}))

import { handleNonceRequest, authenticateMerchant, destroyAuthStore, buildAuthMessage, nonceStore, NONCE_TTL_MS } from '../../src/api/auth.js'

// Test account (never use in production)
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const
const testAccount = privateKeyToAccount(TEST_PRIVATE_KEY)
const TEST_ADDRESS = testAccount.address

function createMockReq(overrides: Record<string, unknown> = {}): IncomingMessage {
  return {
    url: '/auth/nonce?address=' + TEST_ADDRESS,
    headers: { host: 'localhost:3001' },
    ...overrides,
  } as unknown as IncomingMessage
}

function createMockRes(): ServerResponse & { _status: number; _body: string; _headers: Record<string, string> } {
  const res = {
    _status: 0,
    _body: '',
    _headers: {} as Record<string, string>,
    writeHead(status: number, headers?: Record<string, string>) {
      res._status = status
      if (headers) Object.assign(res._headers, headers)
      return res
    },
    setHeader(name: string, value: string) {
      res._headers[name] = value
      return res
    },
    end(body?: string) {
      res._body = body || ''
      return res
    },
  }
  return res as any
}

describe('Auth module', () => {
  beforeEach(() => {
    nonceStore.clear()
  })

  afterEach(() => {
    destroyAuthStore()
  })

  describe('handleNonceRequest', () => {
    it('returns valid nonce with correct format', () => {
      const req = createMockReq()
      const res = createMockRes()

      handleNonceRequest(req, res)

      expect(res._status).toBe(200)
      const body = JSON.parse(res._body)
      expect(body.nonce).toMatch(/^[a-f0-9]{64}$/)
      expect(body.expiresAt).toBeDefined()
      expect(body.message).toContain('AutoPay Authentication')
      expect(body.message).toContain(body.nonce)
    })

    it('rejects missing address', () => {
      const req = createMockReq({ url: '/auth/nonce' })
      const res = createMockRes()

      handleNonceRequest(req, res)

      expect(res._status).toBe(400)
    })

    it('rejects invalid address format', () => {
      const req = createMockReq({ url: '/auth/nonce?address=not-an-address' })
      const res = createMockRes()

      handleNonceRequest(req, res)

      expect(res._status).toBe(400)
    })

    it('returns 503 when nonce store is at capacity', () => {
      // Fill the store to MAX_NONCES — we'll set a smaller limit by pre-filling
      // Since MAX_NONCES is 100K, we test the concept by checking the store size check
      for (let i = 0; i < 100_000; i++) {
        nonceStore.set(`nonce${i}`, {
          address: '0x' + '0'.repeat(40),
          createdAt: Date.now(),
          expiresAt: Date.now() + 300_000,
        })
      }

      const req = createMockReq()
      const res = createMockRes()

      handleNonceRequest(req, res)

      expect(res._status).toBe(503)
    })
  })

  describe('buildAuthMessage', () => {
    it('produces deterministic output', () => {
      const msg1 = buildAuthMessage('abc123', '2026-01-01T00:00:00.000Z')
      const msg2 = buildAuthMessage('abc123', '2026-01-01T00:00:00.000Z')
      expect(msg1).toBe(msg2)
    })

    it('matches expected format', () => {
      const msg = buildAuthMessage('a'.repeat(64), '2026-02-22T12:00:00.000Z')
      expect(msg).toBe(
        `AutoPay Authentication\nNonce: ${'a'.repeat(64)}\nIssued At: 2026-02-22T12:00:00.000Z`
      )
    })
  })

  describe('authenticateMerchant', () => {
    async function getNonceAndSign(address?: string) {
      const req = createMockReq({
        url: `/auth/nonce?address=${address || TEST_ADDRESS}`,
      })
      const res = createMockRes()
      handleNonceRequest(req, res)
      const { nonce, message } = JSON.parse(res._body)

      const signature = await testAccount.signMessage({ message })
      return { nonce, message, signature }
    }

    it('succeeds with valid nonce and signature', async () => {
      const { nonce, signature } = await getNonceAndSign()

      const req = createMockReq({
        headers: {
          host: 'localhost:3001',
          'x-address': TEST_ADDRESS,
          'x-signature': signature,
          'x-nonce': nonce,
        },
      })
      const res = createMockRes()

      const result = await authenticateMerchant(req, res, TEST_ADDRESS)
      expect(result).toBe(TEST_ADDRESS.toLowerCase())
    })

    it('rejects missing auth headers', async () => {
      const req = createMockReq({ headers: { host: 'localhost:3001' } })
      const res = createMockRes()

      const result = await authenticateMerchant(req, res, TEST_ADDRESS)
      expect(result).toBeNull()
      expect(res._status).toBe(401)
    })

    it('rejects invalid nonce format', async () => {
      const req = createMockReq({
        headers: {
          host: 'localhost:3001',
          'x-address': TEST_ADDRESS,
          'x-signature': '0x' + 'a'.repeat(130),
          'x-nonce': 'too-short',
        },
      })
      const res = createMockRes()

      const result = await authenticateMerchant(req, res, TEST_ADDRESS)
      expect(result).toBeNull()
      expect(res._status).toBe(401)
    })

    it('rejects nonce that does not exist in store', async () => {
      const req = createMockReq({
        headers: {
          host: 'localhost:3001',
          'x-address': TEST_ADDRESS,
          'x-signature': '0x' + 'a'.repeat(130),
          'x-nonce': 'a'.repeat(64),
        },
      })
      const res = createMockRes()

      const result = await authenticateMerchant(req, res, TEST_ADDRESS)
      expect(result).toBeNull()
      expect(res._status).toBe(401)
    })

    it('nonce is single-use — second attempt rejected', async () => {
      const { nonce, signature } = await getNonceAndSign()

      const makeReq = () =>
        createMockReq({
          headers: {
            host: 'localhost:3001',
            'x-address': TEST_ADDRESS,
            'x-signature': signature,
            'x-nonce': nonce,
          },
        })

      const res1 = createMockRes()
      const result1 = await authenticateMerchant(makeReq(), res1, TEST_ADDRESS)
      expect(result1).toBe(TEST_ADDRESS.toLowerCase())

      // Second use of same nonce
      const res2 = createMockRes()
      const result2 = await authenticateMerchant(makeReq(), res2, TEST_ADDRESS)
      expect(result2).toBeNull()
      expect(res2._status).toBe(401)
    })

    it('rejects expired nonce', async () => {
      vi.useFakeTimers()
      try {
        const { nonce, signature } = await getNonceAndSign()

        // Advance past TTL
        vi.advanceTimersByTime(NONCE_TTL_MS + 1000)

        const req = createMockReq({
          headers: {
            host: 'localhost:3001',
            'x-address': TEST_ADDRESS,
            'x-signature': signature,
            'x-nonce': nonce,
          },
        })
        const res = createMockRes()

        const result = await authenticateMerchant(req, res, TEST_ADDRESS)
        expect(result).toBeNull()
        expect(res._status).toBe(401)
      } finally {
        vi.useRealTimers()
      }
    })

    it('signature from wrong address is rejected', async () => {
      // Get nonce for a different address
      const otherAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
      const { nonce } = await getNonceAndSign(otherAddress)

      // Sign with test account (which does not own otherAddress)
      const stored = nonceStore.get(nonce)!
      const message = buildAuthMessage(nonce, new Date(stored.createdAt).toISOString())
      const signature = await testAccount.signMessage({ message })

      const req = createMockReq({
        headers: {
          host: 'localhost:3001',
          'x-address': otherAddress,
          'x-signature': signature,
          'x-nonce': nonce,
        },
      })
      const res = createMockRes()

      const result = await authenticateMerchant(req, res, otherAddress)
      expect(result).toBeNull()
      // Could be 401 (recovered address != header address)
      expect(res._status).toBe(401)
    })

    it('address mismatch (header vs path) returns 403', async () => {
      const { nonce, signature } = await getNonceAndSign()

      const req = createMockReq({
        headers: {
          host: 'localhost:3001',
          'x-address': TEST_ADDRESS,
          'x-signature': signature,
          'x-nonce': nonce,
        },
      })
      const res = createMockRes()

      // Path address is different from header address
      const differentAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
      const result = await authenticateMerchant(req, res, differentAddress)
      expect(result).toBeNull()
      expect(res._status).toBe(403)
      expect(JSON.parse(res._body).error).toBe('Forbidden')
    })
  })
})
