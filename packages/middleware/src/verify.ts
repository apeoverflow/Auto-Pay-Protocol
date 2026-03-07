import { createPublicClient, http, recoverMessageAddress, type PublicClient } from 'viem'
import type { VerifierOptions, VerifyResult, PolicyData } from './types'

/** Minimal ABI — only the policies() getter */
const POLICIES_ABI = [
  {
    type: 'function' as const,
    name: 'policies' as const,
    inputs: [{ name: '', type: 'bytes32' as const }],
    outputs: [
      { name: 'payer', type: 'address' as const },
      { name: 'merchant', type: 'address' as const },
      { name: 'chargeAmount', type: 'uint128' as const },
      { name: 'spendingCap', type: 'uint128' as const },
      { name: 'totalSpent', type: 'uint128' as const },
      { name: 'interval', type: 'uint32' as const },
      { name: 'lastCharged', type: 'uint32' as const },
      { name: 'chargeCount', type: 'uint32' as const },
      { name: 'consecutiveFailures', type: 'uint8' as const },
      { name: 'endTime', type: 'uint32' as const },
      { name: 'active', type: 'bool' as const },
      { name: 'metadataUrl', type: 'string' as const },
    ],
    stateMutability: 'view' as const,
  },
] as const

interface CacheEntry {
  policy: PolicyData
  checkedAt: number
}

/** Parsed signed Bearer token: {policyId}.{expiry}.{signature} */
export interface ParsedToken {
  policyId: `0x${string}`
  expiry: number
  signature: `0x${string}`
}

/**
 * Parse a signed Bearer token.
 *
 * Format: `{policyId}.{timestamp}.{signature}`
 * - policyId: bytes32 hex (0x + 64 chars)
 * - timestamp: unix expiry in seconds
 * - signature: EIP-191 signature of `{policyId}:{timestamp}`
 *
 * Returns null if the format is invalid.
 */
export function parseBearerToken(token: string): ParsedToken | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [policyId, ts, sig] = parts
  if (
    !(/^0x[a-fA-F0-9]{64}$/.test(policyId)) ||
    !(/^\d+$/.test(ts)) ||
    !(/^0x[a-fA-F0-9]+$/.test(sig))
  ) {
    return null
  }

  return {
    policyId: policyId as `0x${string}`,
    expiry: Number(ts),
    signature: sig as `0x${string}`,
  }
}

/**
 * Creates a subscription verifier that:
 * 1. Parses the signed Bearer token
 * 2. Checks token expiry
 * 3. Recovers the signer from the signature
 * 4. Reads the on-chain policy (with caching)
 * 5. Verifies: active, merchant match, signer == payer
 */
export function createSubscriptionVerifier(options: VerifierOptions) {
  const {
    merchant,
    policyManager,
    rpcUrl,
    cacheTtlMs = 60_000,
    maxTokenAgeSeconds = 86_400,
    clockSkewSeconds = 30,
  } = options

  const client: PublicClient = options.client ?? createPublicClient({ transport: http(rpcUrl) })
  const cache = new Map<string, CacheEntry>()
  const MAX_CACHE_SIZE = 1000

  async function verifySubscription(token: string): Promise<VerifyResult> {
    // Parse the signed token
    const parsed = parseBearerToken(token)
    if (!parsed) {
      return { ok: false, reason: 'Invalid token format. Expected: {policyId}.{expiry}.{signature}' }
    }

    // Check expiry (with clock skew tolerance)
    const now = Math.floor(Date.now() / 1000)
    if (parsed.expiry < now - clockSkewSeconds) {
      return { ok: false, reason: 'Token expired' }
    }

    // Enforce max token lifetime — reject tokens with expiry too far in the future
    if (parsed.expiry > now + maxTokenAgeSeconds + clockSkewSeconds) {
      return { ok: false, reason: `Token lifetime exceeds maximum allowed (${maxTokenAgeSeconds}s)` }
    }

    // Recover signer from signature
    let signer: `0x${string}`
    try {
      const message = `${parsed.policyId}:${parsed.expiry}`
      signer = await recoverMessageAddress({ message, signature: parsed.signature })
    } catch {
      return { ok: false, reason: 'Invalid signature' }
    }

    // Check cache
    const cached = cache.get(parsed.policyId)
    if (cached && Date.now() - cached.checkedAt < cacheTtlMs) {
      if (cached.policy.payer.toLowerCase() !== signer.toLowerCase()) {
        return { ok: false, reason: 'Signer does not match policy payer' }
      }
      return { ok: true, policy: cached.policy }
    }

    // Read on-chain
    let result: readonly [
      `0x${string}`, `0x${string}`, bigint, bigint, bigint,
      number, number, number, number, number, boolean, string
    ]

    try {
      result = await client.readContract({
        address: policyManager,
        abi: POLICIES_ABI,
        functionName: 'policies',
        args: [parsed.policyId],
      })
    } catch {
      return { ok: false, reason: 'Failed to read policy on-chain' }
    }

    const policy: PolicyData = {
      payer: result[0],
      merchant: result[1],
      chargeAmount: result[2],
      spendingCap: result[3],
      totalSpent: result[4],
      interval: result[5],
      lastCharged: result[6],
      chargeCount: result[7],
      consecutiveFailures: result[8],
      endTime: result[9],
      active: result[10],
      metadataUrl: result[11],
    }

    if (!policy.active) {
      cache.delete(parsed.policyId)
      return { ok: false, reason: 'Subscription expired or cancelled' }
    }

    if (policy.merchant.toLowerCase() !== merchant.toLowerCase()) {
      return { ok: false, reason: 'Policy is for a different merchant' }
    }

    if (policy.payer.toLowerCase() !== signer.toLowerCase()) {
      return { ok: false, reason: 'Signer does not match policy payer' }
    }

    if (cache.size >= MAX_CACHE_SIZE) {
      cache.clear()
    }
    cache.set(parsed.policyId, { policy, checkedAt: Date.now() })
    return { ok: true, policy }
  }

  function invalidateCache(policyId?: string) {
    if (policyId) {
      cache.delete(policyId)
    } else {
      cache.clear()
    }
  }

  return { verifySubscription, invalidateCache }
}
