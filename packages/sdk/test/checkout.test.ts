import { describe, it, expect } from 'vitest'
import { createCheckoutUrl, parseSuccessRedirect, resolveInterval } from '../src/checkout'
import { AutoPayCheckoutError } from '../src/errors'

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
    expect(() => resolveInterval('daily' as any)).toThrow(AutoPayCheckoutError)
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

    expect(parsed.origin).toBe('https://autopayprotocol.com')
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
  it('parses policyId and txHash from query string', () => {
    const qs = '?policyId=0xabc123&txHash=0xdef456'
    const result = parseSuccessRedirect(qs)
    expect(result.policyId).toBe('0xabc123')
    expect(result.txHash).toBe('0xdef456')
  })

  it('throws on missing policyId', () => {
    expect(() => parseSuccessRedirect('?txHash=0xdef456'))
      .toThrow(AutoPayCheckoutError)
  })

  it('throws on missing txHash', () => {
    expect(() => parseSuccessRedirect('?policyId=0xabc123'))
      .toThrow(AutoPayCheckoutError)
  })
})
