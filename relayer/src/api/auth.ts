import { randomBytes } from 'crypto'
import { recoverMessageAddress } from 'viem'
import type { IncomingMessage, ServerResponse } from 'http'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('auth')

// --- Constants ---

const NONCE_TTL_MS = 300_000 // 5 minutes
const NONCE_BYTES = 32 // 256-bit entropy
const MAX_NONCES = 100_000
const CLEANUP_INTERVAL_MS = 60_000

// --- Validation regexes ---

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const NONCE_RE = /^[a-f0-9]{64}$/
const SIGNATURE_RE = /^0x[a-fA-F0-9]{130}$/

// --- Nonce store ---

interface NonceEntry {
  address: string // lowercase
  createdAt: number // epoch ms
  expiresAt: number // epoch ms
}

const nonceStore = new Map<string, NonceEntry>()

let cleanupTimer: ReturnType<typeof setInterval> | null = null

function startCleanup(): void {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [nonce, entry] of nonceStore) {
      if (entry.expiresAt <= now) {
        nonceStore.delete(nonce)
      }
    }
  }, CLEANUP_INTERVAL_MS)
  if (cleanupTimer.unref) cleanupTimer.unref()
}

startCleanup()

// --- Helpers ---

function buildAuthMessage(nonce: string, issuedAt: string): string {
  return `AutoPay Authentication\nNonce: ${nonce}\nIssued At: ${issuedAt}`
}

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// --- Exported functions ---

/**
 * Handle GET /auth/nonce?address=0x...
 * Returns a nonce + pre-built message for the client to sign.
 */
export function handleNonceRequest(
  req: IncomingMessage,
  res: ServerResponse
): void {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const address = url.searchParams.get('address')

  if (!address || !ADDRESS_RE.test(address)) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Valid address query parameter required' }))
    return
  }

  // Hard cap on nonces to prevent OOM
  if (nonceStore.size >= MAX_NONCES) {
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Service temporarily unavailable' }))
    return
  }

  const nonce = randomBytes(NONCE_BYTES).toString('hex')
  const now = Date.now()
  const expiresAt = now + NONCE_TTL_MS
  const createdAt = new Date(now).toISOString()

  nonceStore.set(nonce, {
    address: address.toLowerCase(),
    createdAt: now,
    expiresAt,
  })

  const message = buildAuthMessage(nonce, createdAt)

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(
    JSON.stringify({
      nonce,
      expiresAt: new Date(expiresAt).toISOString(),
      message,
    })
  )
}

/**
 * Verify EIP-191 signature and ensure the signer owns the path address.
 *
 * Returns the verified lowercase address, or null if auth failed
 * (error response is already written to `res`).
 */
export async function authenticateMerchant(
  req: IncomingMessage,
  res: ServerResponse,
  pathAddress: string
): Promise<string | null> {
  const headerAddress = req.headers['x-address'] as string | undefined
  const headerSignature = req.headers['x-signature'] as string | undefined
  const headerNonce = req.headers['x-nonce'] as string | undefined

  // Step 2: Validate header formats
  if (
    !headerAddress ||
    !ADDRESS_RE.test(headerAddress) ||
    !headerNonce ||
    !NONCE_RE.test(headerNonce) ||
    !headerSignature ||
    !SIGNATURE_RE.test(headerSignature)
  ) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid or expired authentication' }))
    return null
  }

  // Step 3: Look up nonce
  const stored = nonceStore.get(headerNonce)
  if (!stored || stored.expiresAt <= Date.now()) {
    // Clean up expired nonce if present
    if (stored) nonceStore.delete(headerNonce)
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid or expired authentication' }))
    return null
  }

  // Step 4: Verify stored address matches header address (constant-time)
  if (!timingSafeEqual(stored.address, headerAddress.toLowerCase())) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid or expired authentication' }))
    return null
  }

  // Step 5: Reconstruct the message
  const issuedAt = new Date(stored.createdAt).toISOString()
  const message = buildAuthMessage(headerNonce, issuedAt)

  // Step 8: Delete nonce BEFORE recovery (single-use — prevents replay even on slow recovery)
  nonceStore.delete(headerNonce)

  try {
    // Step 6: Recover signer address from signature
    const recovered = await recoverMessageAddress({
      message,
      signature: headerSignature as `0x${string}`,
    })

    // Step 7: Compare recovered vs header address (constant-time, case-insensitive)
    if (!timingSafeEqual(recovered.toLowerCase(), headerAddress.toLowerCase())) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid or expired authentication' }))
      return null
    }

    // Step 9: Compare verified address vs path address
    if (!timingSafeEqual(recovered.toLowerCase(), pathAddress.toLowerCase())) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Forbidden' }))
      return null
    }

    // Step 10: Return verified lowercase address
    return recovered.toLowerCase()
  } catch (err) {
    logger.warn({ err }, 'Signature recovery failed')
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid or expired authentication' }))
    return null
  }
}

/**
 * Clear the nonce store and cleanup timer on shutdown.
 */
export function destroyAuthStore(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
  nonceStore.clear()
}

// Exported for testing
export { buildAuthMessage, nonceStore, NONCE_TTL_MS }
