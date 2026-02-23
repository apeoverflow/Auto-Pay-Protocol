export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number | null
}

interface WindowEntry {
  timestamps: number[]
}

export class SlidingWindowRateLimiter {
  private windows = new Map<string, WindowEntry>()
  private cleanupTimer: ReturnType<typeof setInterval>
  private windowMs: number
  private maxRequests: number
  private maxKeys: number

  constructor(
    config: { windowMs: number; maxRequests: number },
    maxKeys = 50_000
  ) {
    this.windowMs = config.windowMs
    this.maxRequests = config.maxRequests
    this.maxKeys = maxKeys

    // Sweep expired entries every 60s
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000)
    // Don't block Node from exiting
    if (this.cleanupTimer.unref) this.cleanupTimer.unref()
  }

  check(key: string): RateLimitResult {
    const now = Date.now()
    const windowStart = now - this.windowMs

    let entry = this.windows.get(key)

    if (!entry) {
      // Reject new keys when at hard cap
      if (this.windows.size >= this.maxKeys) {
        return { allowed: false, remaining: 0, retryAfterMs: this.windowMs }
      }
      entry = { timestamps: [] }
      this.windows.set(key, entry)
    }

    // Filter out expired timestamps
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

    if (entry.timestamps.length >= this.maxRequests) {
      // Calculate when the oldest request in window expires
      const oldestInWindow = entry.timestamps[0]
      const retryAfterMs = oldestInWindow + this.windowMs - now
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(retryAfterMs, 1),
      }
    }

    entry.timestamps.push(now)
    return {
      allowed: true,
      remaining: this.maxRequests - entry.timestamps.length,
      retryAfterMs: null,
    }
  }

  private cleanup(): void {
    const now = Date.now()
    const windowStart = now - this.windowMs

    for (const [key, entry] of this.windows) {
      // Remove keys where all timestamps are expired
      if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] <= windowStart) {
        this.windows.delete(key)
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupTimer)
    this.windows.clear()
  }
}
