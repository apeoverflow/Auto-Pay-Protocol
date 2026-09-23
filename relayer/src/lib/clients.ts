import { createPublicClient, http, type PublicClient } from 'viem'
import type { ChainConfig } from '../types.js'

/**
 * Shared viem PublicClient cache, keyed by chainId. The approval monitor
 * (and any future callers that need read-only chain access) grabs a
 * long-lived client here rather than instantiating one per tick — the
 * HTTP transport keeps its own connection pool internally.
 *
 * Every viem client created here has multicall batching enabled so
 * per-payer `allowance` reads collapse to a single JSON-RPC batch call.
 */
const CLIENTS = new Map<number, PublicClient>()

export function getPublicClient(config: ChainConfig): PublicClient {
  const cached = CLIENTS.get(config.chainId)
  if (cached) return cached

  const client = createPublicClient({
    transport: http(config.rpcUrl, { retryCount: 3, retryDelay: 1000 }),
    batch: { multicall: true },
  })
  CLIENTS.set(config.chainId, client)
  return client
}

/** Test helper — drop cached clients (e.g. between integration test suites). */
export function clearPublicClientCache(): void {
  CLIENTS.clear()
}

/**
 * Test helper — inject a specific client (typically a stub with a canned
 * `multicall` response) into the cache for a given chainId. Callers should
 * pair with `clearPublicClientCache()` in teardown.
 */
export function setPublicClient(chainId: number, client: PublicClient): void {
  CLIENTS.set(chainId, client)
}
