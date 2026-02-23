import { describe, it, expect, afterEach, vi } from 'vitest'
import { SlidingWindowRateLimiter } from '../../src/api/rate-limit.js'

describe('SlidingWindowRateLimiter', () => {
  let limiter: SlidingWindowRateLimiter

  afterEach(() => {
    limiter?.destroy()
  })

  it('allows requests under limit', () => {
    limiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 5 })

    for (let i = 0; i < 5; i++) {
      const result = limiter.check('key1')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4 - i)
      expect(result.retryAfterMs).toBeNull()
    }
  })

  it('blocks requests at limit', () => {
    limiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 3 })

    for (let i = 0; i < 3; i++) {
      expect(limiter.check('key1').allowed).toBe(true)
    }

    const result = limiter.check('key1')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('window slides correctly — old requests expire', () => {
    vi.useFakeTimers()
    try {
      limiter = new SlidingWindowRateLimiter({ windowMs: 1000, maxRequests: 2 })

      expect(limiter.check('key1').allowed).toBe(true)
      expect(limiter.check('key1').allowed).toBe(true)
      expect(limiter.check('key1').allowed).toBe(false)

      // Advance past window
      vi.advanceTimersByTime(1001)

      // Old requests expired, should allow again
      const result = limiter.check('key1')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns correct retryAfterMs', () => {
    vi.useFakeTimers()
    try {
      limiter = new SlidingWindowRateLimiter({ windowMs: 10_000, maxRequests: 1 })

      expect(limiter.check('key1').allowed).toBe(true)

      const result = limiter.check('key1')
      expect(result.allowed).toBe(false)
      // retryAfterMs should be close to the full window since request was just made
      expect(result.retryAfterMs).toBeGreaterThan(9_000)
      expect(result.retryAfterMs).toBeLessThanOrEqual(10_000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('hard cap rejects new keys when full', () => {
    limiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 10 }, 3)

    expect(limiter.check('key1').allowed).toBe(true)
    expect(limiter.check('key2').allowed).toBe(true)
    expect(limiter.check('key3').allowed).toBe(true)

    // 4th unique key should be rejected
    const result = limiter.check('key4')
    expect(result.allowed).toBe(false)

    // Existing keys still work
    expect(limiter.check('key1').allowed).toBe(true)
  })

  it('tracks keys independently', () => {
    limiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 2 })

    expect(limiter.check('key1').allowed).toBe(true)
    expect(limiter.check('key1').allowed).toBe(true)
    expect(limiter.check('key1').allowed).toBe(false)

    // Different key should still be allowed
    expect(limiter.check('key2').allowed).toBe(true)
  })

  it('destroy clears cleanup timer', () => {
    limiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 10 })
    expect(limiter.check('key1').allowed).toBe(true)

    limiter.destroy()

    // After destroy, check still works but the map is cleared
    // (no crashes, just a fresh start)
    const result = limiter.check('key1')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9)
  })
})
