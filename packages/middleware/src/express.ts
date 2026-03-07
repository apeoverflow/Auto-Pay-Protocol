import type { Request, Response, NextFunction } from 'express'
import type { MiddlewareOptions } from './types'
import { chains } from './chains'
import { createSubscriptionVerifier } from './verify'
import { createDiscoveryBody } from './discovery'

declare module 'express-serve-static-core' {
  interface Request {
    subscriber?: string
    policyId?: string
  }
}

/**
 * Express middleware that gates routes behind an active AutoPay subscription.
 *
 * - Resolves chain config (policyManager, rpcUrl, USDC) from the `chain` key
 * - Extracts `Authorization: Bearer {policyId}.{expiry}.{signature}` header
 * - Verifies the signed token: expiry, signature recovery, on-chain policy (with caching)
 * - Returns 402 with discovery body on failure
 * - Sets `req.subscriber` and `req.policyId` on success
 *
 * Usage:
 * ```ts
 * const auth = requireSubscription({ merchant: '0x...', chain: 'base', plans: [...] })
 * app.get('/api/data', auth, handler)
 * ```
 */
export function requireSubscription(options: MiddlewareOptions) {
  const chainConfig = chains[options.chain]
  if (!chainConfig) {
    throw new Error(`Unknown chain: "${options.chain}". Supported: ${Object.keys(chains).join(', ')}`)
  }

  const { verifySubscription, invalidateCache } = createSubscriptionVerifier({
    merchant: options.merchant,
    policyManager: chainConfig.policyManager,
    rpcUrl: options.rpcUrl ?? chainConfig.rpcUrl,
    cacheTtlMs: options.cacheTtlMs,
    maxTokenAgeSeconds: options.maxTokenAgeSeconds,
    clockSkewSeconds: options.clockSkewSeconds,
  })

  const discoveryBody = createDiscoveryBody({
    merchant: options.merchant,
    plans: options.plans,
    networks: [{
      chainId: chainConfig.chainId,
      name: chainConfig.name,
      policyManager: chainConfig.policyManager,
      usdc: chainConfig.usdc,
    }],
    relayerUrl: options.relayerUrl,
  })

  const middleware = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null

    if (!token) {
      res.status(402).json(discoveryBody)
      return
    }

    const result = await verifySubscription(token)

    if (!result.ok) {
      res.status(402).json({ ...discoveryBody, error: result.reason })
      return
    }

    req.subscriber = result.policy.payer
    req.policyId = token.split('.')[0]
    next()
  }

  middleware.invalidateCache = invalidateCache

  return middleware
}
