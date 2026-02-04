// Simple rate limiter for RPC requests
// Arc testnet has aggressive rate limiting

const RATE_LIMIT_DELAY = 500 // ms between requests

let lastRequestTime = 0

export async function rateLimitedRequest<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime

  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await sleep(RATE_LIMIT_DELAY - timeSinceLastRequest)
  }

  lastRequestTime = Date.now()
  return fn()
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
