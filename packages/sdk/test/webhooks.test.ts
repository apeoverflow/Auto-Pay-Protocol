import { describe, it, expect } from 'vitest'
import { verifyWebhook, signPayload, verifySignature } from '../src/webhooks'
import { AutoPayWebhookError } from '../src/errors'

const SECRET = 'test-webhook-secret-123'

function makePayload(event: string, data: Record<string, unknown> = {}) {
  return JSON.stringify({
    event,
    timestamp: '2026-02-07T12:00:00Z',
    data: {
      policyId: '0xabc',
      chainId: 1868,
      payer: '0x1111111111111111111111111111111111111111',
      merchant: '0x2222222222222222222222222222222222222222',
      ...data,
    },
  })
}

describe('signPayload / verifySignature', () => {
  it('produces a valid HMAC-SHA256 hex signature', () => {
    const payload = 'hello world'
    const sig = signPayload(payload, SECRET)
    expect(sig).toMatch(/^[a-f0-9]{64}$/)
  })

  it('verifies a correct signature', () => {
    const payload = 'test payload'
    const sig = signPayload(payload, SECRET)
    expect(verifySignature(payload, sig, SECRET)).toBe(true)
  })

  it('rejects an incorrect signature', () => {
    const payload = 'test payload'
    expect(verifySignature(payload, 'bad-signature', SECRET)).toBe(false)
  })

  it('rejects a tampered payload', () => {
    const payload = 'original'
    const sig = signPayload(payload, SECRET)
    expect(verifySignature('tampered', sig, SECRET)).toBe(false)
  })
})

describe('verifyWebhook', () => {
  it('verifies and parses charge.succeeded', () => {
    const payload = makePayload('charge.succeeded', {
      amount: '9990000',
      protocolFee: '249750',
      txHash: '0xtx123',
    })
    const sig = signPayload(payload, SECRET)
    const event = verifyWebhook(payload, sig, SECRET)

    expect(event.type).toBe('charge.succeeded')
    expect(event.data.policyId).toBe('0xabc')
    if (event.type === 'charge.succeeded') {
      expect(event.data.amount).toBe('9990000')
      expect(event.data.protocolFee).toBe('249750')
      expect(event.data.txHash).toBe('0xtx123')
    }
  })

  it('verifies and parses charge.failed', () => {
    const payload = makePayload('charge.failed', { reason: 'insufficient_balance' })
    const sig = signPayload(payload, SECRET)
    const event = verifyWebhook(payload, sig, SECRET)

    expect(event.type).toBe('charge.failed')
    if (event.type === 'charge.failed') {
      expect(event.data.reason).toBe('insufficient_balance')
    }
  })

  it('verifies and parses policy.created', () => {
    const payload = makePayload('policy.created', {
      chargeAmount: '9990000',
      interval: 2592000,
      spendingCap: '119880000',
      metadataUrl: 'https://example.com/plan.json',
    })
    const sig = signPayload(payload, SECRET)
    const event = verifyWebhook(payload, sig, SECRET)

    expect(event.type).toBe('policy.created')
    if (event.type === 'policy.created') {
      expect(event.data.chargeAmount).toBe('9990000')
      expect(event.data.interval).toBe(2592000)
    }
  })

  it('verifies and parses policy.revoked', () => {
    const payload = makePayload('policy.revoked', { endTime: 1700000000 })
    const sig = signPayload(payload, SECRET)
    const event = verifyWebhook(payload, sig, SECRET)

    expect(event.type).toBe('policy.revoked')
    if (event.type === 'policy.revoked') {
      expect(event.data.endTime).toBe(1700000000)
    }
  })

  it('verifies and parses policy.cancelled_by_failure', () => {
    const payload = makePayload('policy.cancelled_by_failure', {
      consecutiveFailures: 3,
      endTime: 1700000000,
    })
    const sig = signPayload(payload, SECRET)
    const event = verifyWebhook(payload, sig, SECRET)

    expect(event.type).toBe('policy.cancelled_by_failure')
    if (event.type === 'policy.cancelled_by_failure') {
      expect(event.data.consecutiveFailures).toBe(3)
    }
  })

  it('throws on missing signature', () => {
    const payload = makePayload('charge.succeeded')
    expect(() => verifyWebhook(payload, undefined, SECRET)).toThrow(AutoPayWebhookError)
  })

  it('throws on invalid signature', () => {
    const payload = makePayload('charge.succeeded')
    expect(() => verifyWebhook(payload, 'wrong', SECRET)).toThrow(AutoPayWebhookError)
  })

  it('throws on missing secret', () => {
    const payload = makePayload('charge.succeeded')
    const sig = signPayload(payload, SECRET)
    expect(() => verifyWebhook(payload, sig, '')).toThrow(AutoPayWebhookError)
  })

  it('throws on unknown event type', () => {
    const payload = makePayload('unknown.event')
    const sig = signPayload(payload, SECRET)
    expect(() => verifyWebhook(payload, sig, SECRET)).toThrow(AutoPayWebhookError)
  })

  it('throws on invalid JSON', () => {
    const payload = 'not json'
    const sig = signPayload(payload, SECRET)
    expect(() => verifyWebhook(payload, sig, SECRET)).toThrow(AutoPayWebhookError)
  })
})
