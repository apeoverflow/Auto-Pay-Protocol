import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http'
import { getDb, getStatus } from '../db/index.js'
import { getChargesByMerchant } from '../db/charges.js'
import { getPlanMetadata, getPlanMetadataByMerchant, listAllPlanMetadata, insertPlanMetadata, updatePlanMetadata, deletePlanMetadata, type PlanMetadata, type PlanStatus } from '../db/metadata.js'
import { setMerchantEncryptionKey } from '../db/merchants.js'
import { getReportsByMerchant } from '../db/reports.js'
import { randomUUID } from 'crypto'
import { getEnabledChains, type RelayerConfig } from '../config.js'
import { createLogger } from '../utils/logger.js'
import { uploadPlanToIPFS } from '../lib/ipfs-upload.js'
import { isStorachaEnabled, ipfsGatewayUrl } from '../lib/storacha.js'
import { handleNonceRequest, authenticateMerchant, destroyAuthStore } from './auth.js'
import { SlidingWindowRateLimiter, type RateLimitResult } from './rate-limit.js'
import { getLogoStorage } from '../lib/logo-storage.js'
import sharp from 'sharp'

const logger = createLogger('api')

const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true'
const nonceRateLimiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 10 })
const authRateLimiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 60 })

// Valid image content types for logo uploads
// SVG intentionally excluded — serving SVGs as image/svg+xml is an XSS vector
const VALID_IMAGE_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
])

// Valid billing intervals
const VALID_INTERVALS = ['seconds', 'minutes', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']

// Valid plan statuses
const VALID_STATUSES: PlanStatus[] = ['draft', 'active', 'archived']

// Valid status transitions: from -> allowed destinations
const STATUS_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  draft: ['active'],
  active: ['archived'],
  archived: ['active'],
}

// Get the logo storage backend (lazy singleton)
function getLogos() {
  return getLogoStorage()
}

// Build a logo resolver that converts relative filenames to absolute URLs
function buildLogoResolver(): ((filename: string) => string | null) {
  const storage = getLogos()
  return (filename: string) => storage.publicUrl(filename)
}

// Compute ipfsMetadataUrl from a plan's ipfs_cid
function computeIpfsMetadataUrl(ipfsCid: string | null | undefined): string | null {
  return ipfsCid ? ipfsGatewayUrl(ipfsCid) : null
}

// Parse URL path
function parsePath(url: string): { path: string; params: URLSearchParams } {
  const [path, query] = url.split('?')
  return {
    path: path || '/',
    params: new URLSearchParams(query || ''),
  }
}

// CORS headers
function setCorsHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Address, X-Signature, X-Nonce, X-API-Key')
}

// Parse JSON body from request
function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString()
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

// Parse raw body bytes from request (for file uploads)
const MAX_UPLOAD_SIZE = 512 * 1024 // 512KB
function parseRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_UPLOAD_SIZE) {
        req.destroy()
        reject(new Error('File too large (max 512KB)'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// Validate merchant address format
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// Get client IP from socket (not X-Forwarded-For to avoid spoofing)
function getClientIp(req: IncomingMessage): string {
  return req.socket.remoteAddress || 'unknown'
}

// Send 429 Too Many Requests with Retry-After header
function sendRateLimited(res: ServerResponse, result: RateLimitResult): void {
  const retryAfterSec = result.retryAfterMs ? Math.ceil(result.retryAfterMs / 1000) : 60
  res.writeHead(429, {
    'Content-Type': 'application/json',
    'Retry-After': String(retryAfterSec),
  })
  res.end(JSON.stringify({ error: 'Too many requests' }))
}

// Validate custom plan ID format
function isValidPlanId(id: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/.test(id)
}

// Validate billing object (all fields required when billing is present)
function validateBilling(billing: Record<string, unknown>): { valid: true } | { valid: false; error: string } {
  const { amount, interval, cap, currency } = billing

  if (amount === undefined) return { valid: false, error: 'billing.amount is required' }
  if (interval === undefined) return { valid: false, error: 'billing.interval is required' }
  if (cap === undefined) return { valid: false, error: 'billing.cap is required' }

  const parsedAmount = Number(amount)
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return { valid: false, error: 'billing.amount must be a positive number' }
  }

  if (!VALID_INTERVALS.includes(interval as string)) {
    return { valid: false, error: `billing.interval must be one of: ${VALID_INTERVALS.join(', ')}` }
  }

  const parsedCap = Number(cap)
  if (isNaN(parsedCap) || parsedCap <= 0) {
    return { valid: false, error: 'billing.cap must be a positive number' }
  }

  if (parsedCap < parsedAmount) {
    return { valid: false, error: 'billing.cap must be >= billing.amount' }
  }

  if (currency !== undefined && typeof currency !== 'string') {
    return { valid: false, error: 'billing.currency must be a string' }
  }

  return { valid: true }
}

// Validate billing for PATCH (partial — fields are optional since we merge with existing)
function validateBillingPartial(billing: Record<string, unknown>): { valid: true } | { valid: false; error: string } {
  const { amount, interval, cap, currency } = billing

  if (amount !== undefined) {
    const parsed = Number(amount)
    if (isNaN(parsed) || parsed <= 0) {
      return { valid: false, error: 'billing.amount must be a positive number' }
    }
  }

  if (interval !== undefined) {
    if (!VALID_INTERVALS.includes(interval as string)) {
      return { valid: false, error: `billing.interval must be one of: ${VALID_INTERVALS.join(', ')}` }
    }
  }

  if (cap !== undefined) {
    const parsedCap = Number(cap)
    if (isNaN(parsedCap) || parsedCap <= 0) {
      return { valid: false, error: 'billing.cap must be a positive number' }
    }
  }

  if (currency !== undefined && typeof currency !== 'string') {
    return { valid: false, error: 'billing.currency must be a string' }
  }

  return { valid: true }
}

// Keys that must never be merged (prototype pollution prevention)
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

// Deep merge two objects (second overwrites first at leaf level)
// null values in patch remove the key from result
function deepMerge<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
  const result = { ...base }
  for (const key of Object.keys(patch)) {
    if (FORBIDDEN_KEYS.has(key)) continue

    const baseVal = (base as Record<string, unknown>)[key]
    const patchVal = patch[key]

    if (patchVal === null) {
      // null means "remove this field"
      delete (result as Record<string, unknown>)[key]
    } else if (
      typeof patchVal === 'object' &&
      !Array.isArray(patchVal) &&
      baseVal !== null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      ;(result as Record<string, unknown>)[key] = deepMerge(
        baseVal as Record<string, unknown>,
        patchVal as Record<string, unknown>
      )
    } else {
      ;(result as Record<string, unknown>)[key] = patchVal
    }
  }
  return result
}

export async function createApiServer(config: RelayerConfig): Promise<Server> {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    setCorsHeaders(res)

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const { path, params } = parsePath(req.url || '/')

    try {
      // Auth nonce endpoint
      if (path === '/auth/nonce' && req.method === 'GET') {
        const clientIp = getClientIp(req)
        const rateResult = nonceRateLimiter.check(clientIp)
        if (!rateResult.allowed) {
          sendRateLimited(res, rateResult)
          return
        }
        handleNonceRequest(req, res)
        return
      }

      // Root
      if (path === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          service: 'autopay-relayer',
          version: '0.1.0',
          endpoints: {
            health: '/health',
            authNonce: '/auth/nonce?address=0x...',
            metadata: '/metadata/:merchant/:id',
            metadataLegacy: '/metadata/:id (302 redirect)',
            metadataList: '/metadata',
            logo: '/logos/:filename',
            merchantPlans: '/merchants/:address/plans',
            merchantPlan: '/merchants/:address/plans/:id',
            merchantCharges: '/merchants/:address/charges?chain_id=...',
            merchantEncryptionKey: '/merchants/:address/encryption-key',
            merchantReports: '/merchants/:address/reports?chain_id=...',
          },
        }))
        return
      }

      // Health check
      if (path === '/health' && req.method === 'GET') {
        await handleHealth(config, res)
        return
      }

      // List all metadata
      if (path === '/metadata' && req.method === 'GET') {
        await handleMetadataList(config, res)
        return
      }

      // Get specific metadata — merchant-scoped (canonical URL)
      const metadataScopedMatch = path.match(/^\/metadata\/(0x[a-fA-F0-9]{40})\/([^/]+)$/)
      if (metadataScopedMatch && req.method === 'GET') {
        await handleMetadata(config, metadataScopedMatch[2], metadataScopedMatch[1], req, res)
        return
      }

      // Legacy metadata route — redirect to merchant-scoped URL
      const metadataLegacyMatch = path.match(/^\/metadata\/([^/]+)$/)
      if (metadataLegacyMatch && req.method === 'GET') {
        await handleMetadataLegacyRedirect(config, metadataLegacyMatch[1], res)
        return
      }

      // Merchant stats
      const merchantStatsMatch = path.match(/^\/merchants\/([^/]+)\/stats$/)
      if (merchantStatsMatch && req.method === 'GET') {
        const address = merchantStatsMatch[1]
        if (!isValidAddress(address)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid merchant address' }))
          return
        }
        // Optional API key auth: if STATS_API_KEY is set, require it
        const statsApiKey = process.env.STATS_API_KEY
        if (statsApiKey) {
          const providedKey = req.headers['x-api-key'] as string | undefined
          if (providedKey !== statsApiKey) {
            res.writeHead(401, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Invalid or missing API key' }))
            return
          }
        }
        const chainId = params.get('chain_id')
        await handleMerchantStats(config, address, chainId ? parseInt(chainId, 10) : undefined, res)
        return
      }

      // Merchant charges (public, no auth required)
      const merchantChargesMatch = path.match(/^\/merchants\/([^/]+)\/charges$/)
      if (merchantChargesMatch && req.method === 'GET') {
        const address = merchantChargesMatch[1]
        if (!isValidAddress(address)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid merchant address' }))
          return
        }
        const chainId = params.get('chain_id')
        if (!chainId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'chain_id query parameter is required' }))
          return
        }
        const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1)
        const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '50', 10) || 50))
        await handleMerchantCharges(config, address, parseInt(chainId, 10), page, limit, res)
        return
      }

      // Merchant encryption key registration
      const merchantEncKeyMatch = path.match(/^\/merchants\/([^/]+)\/encryption-key$/)
      if (merchantEncKeyMatch && req.method === 'POST') {
        const address = merchantEncKeyMatch[1]
        if (!isValidAddress(address)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid merchant address' }))
          return
        }
        if (AUTH_ENABLED) {
          const rateResult = authRateLimiter.check(address.toLowerCase())
          if (!rateResult.allowed) { sendRateLimited(res, rateResult); return }
          const verified = await authenticateMerchant(req, res, address)
          if (!verified) return
        }
        const body = await parseBody(req)
        const encryptionKey = body.encryptionKey as string | undefined
        if (!encryptionKey || typeof encryptionKey !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(encryptionKey)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'encryptionKey must be a 0x-prefixed 32-byte hex string' }))
          return
        }
        await setMerchantEncryptionKey(config.databaseUrl, address, encryptionKey)
        logger.info({ address }, 'Merchant encryption key registered')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
        return
      }

      // Merchant reports list (public — CIDs are useless without the merchant's decryption key)
      const merchantReportsMatch = path.match(/^\/merchants\/([^/]+)\/reports$/)
      if (merchantReportsMatch && req.method === 'GET') {
        const address = merchantReportsMatch[1]
        if (!isValidAddress(address)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid merchant address' }))
          return
        }
        const chainId = params.get('chain_id')
        if (!chainId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'chain_id query parameter is required' }))
          return
        }
        const reports = await getReportsByMerchant(config.databaseUrl, address, parseInt(chainId, 10))
        const response = reports.map((r) => ({
          period: r.period,
          cid: r.cid,
          createdAt: r.created_at,
        }))
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(response))
        return
      }

      // Merchant plans: list
      const merchantPlansMatch = path.match(/^\/merchants\/([^/]+)\/plans$/)
      if (merchantPlansMatch) {
        const address = merchantPlansMatch[1]
        if (!isValidAddress(address)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid merchant address' }))
          return
        }

        if (req.method === 'GET') {
          const statusFilter = params.get('status') as PlanStatus | null
          if (statusFilter && !VALID_STATUSES.includes(statusFilter)) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: `Invalid status filter. Must be one of: ${VALID_STATUSES.join(', ')}` }))
            return
          }
          await handleListPlans(config, address, res, statusFilter ?? undefined)
          return
        }

        if (req.method === 'POST') {
          if (AUTH_ENABLED) {
            const rateResult = authRateLimiter.check(address.toLowerCase())
            if (!rateResult.allowed) { sendRateLimited(res, rateResult); return }
            const verified = await authenticateMerchant(req, res, address)
            if (!verified) return
          }
          const body = await parseBody(req)
          await handleCreatePlan(config, address, body, res)
          return
        }
      }

      // Merchant plans: get/update/patch/delete specific plan
      const merchantPlanMatch = path.match(/^\/merchants\/([^/]+)\/plans\/([^/]+)$/)
      if (merchantPlanMatch) {
        const address = merchantPlanMatch[1]
        const planId = merchantPlanMatch[2]
        if (!isValidAddress(address)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid merchant address' }))
          return
        }

        if (req.method === 'GET') {
          await handleGetPlan(config, planId, address, res)
          return
        }

        if (req.method === 'PUT') {
          if (AUTH_ENABLED) {
            const rateResult = authRateLimiter.check(address.toLowerCase())
            if (!rateResult.allowed) { sendRateLimited(res, rateResult); return }
            const verified = await authenticateMerchant(req, res, address)
            if (!verified) return
          }
          const body = await parseBody(req)
          await handleUpdatePlan(config, planId, address, body, res)
          return
        }

        if (req.method === 'PATCH') {
          if (AUTH_ENABLED) {
            const rateResult = authRateLimiter.check(address.toLowerCase())
            if (!rateResult.allowed) { sendRateLimited(res, rateResult); return }
            const verified = await authenticateMerchant(req, res, address)
            if (!verified) return
          }
          const body = await parseBody(req)
          await handlePatchPlan(config, planId, address, body, res)
          return
        }

        if (req.method === 'DELETE') {
          if (AUTH_ENABLED) {
            const rateResult = authRateLimiter.check(address.toLowerCase())
            if (!rateResult.allowed) { sendRateLimited(res, rateResult); return }
            const verified = await authenticateMerchant(req, res, address)
            if (!verified) return
          }
          await handleDeletePlan(config, planId, address, res)
          return
        }
      }

      // Upload logo
      if (path === '/logos' && req.method === 'POST') {
        if (AUTH_ENABLED) {
          const addressHeader = req.headers['x-address'] as string | undefined
          const rateKey = addressHeader?.toLowerCase() || getClientIp(req)
          const rateResult = authRateLimiter.check(rateKey)
          if (!rateResult.allowed) { sendRateLimited(res, rateResult); return }
          if (!addressHeader || !isValidAddress(addressHeader)) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Missing or invalid X-Address header' }))
            return
          }
          const verified = await authenticateMerchant(req, res, addressHeader)
          if (!verified) return
        }
        await handleLogoUpload(req, res)
        return
      }

      // Serve logo files
      const logoMatch = path.match(/^\/logos\/([^/]+)$/)
      if (logoMatch && req.method === 'GET') {
        await handleLogo(logoMatch[1], res)
        return
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    } catch (error) {
      logger.error({ error, path }, 'API error')
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
  })

  return server
}

async function handleHealth(config: RelayerConfig, res: ServerResponse) {
  const dbStatus = await getStatus(config.databaseUrl)
  const enabledChains = getEnabledChains(config)

  const response: {
    status: string
    timestamp: string
    chains: Record<number, unknown>
    executor: { healthy: boolean }
    webhooks: { pending: number; failed: number }
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    chains: {},
    executor: { healthy: true },
    webhooks: dbStatus.webhooks,
  }

  for (const chainConfig of enabledChains) {
    const chainStatus = dbStatus.chains[chainConfig.chainId]
    const healthy = chainStatus?.lastIndexedBlock != null

    response.chains[chainConfig.chainId] = {
      name: chainConfig.name,
      lastIndexedBlock: chainStatus?.lastIndexedBlock ?? null,
      activePolicies: chainStatus?.activePolicies ?? 0,
      pendingCharges: chainStatus?.pendingCharges ?? 0,
      healthy,
    }

    if (!healthy) {
      response.status = 'degraded'
    }
  }

  if (dbStatus.webhooks.failed > 10) {
    response.status = 'degraded'
  }

  res.writeHead(response.status === 'healthy' ? 200 : 503, {
    'Content-Type': 'application/json',
  })
  res.end(JSON.stringify(response, null, 2))
}

async function handleMetadataList(config: RelayerConfig, res: ServerResponse) {
  const allMetadata = await listAllPlanMetadata(config.databaseUrl)

  // Public endpoint: only return active plans (consistent with GET /metadata/:id)
  const metadata = allMetadata.filter((m) => m.status === 'active')

  const response = metadata.map((m) => ({
    id: m.id,
    merchantAddress: m.merchant_address,
    planName: m.metadata.plan?.name,
    merchantName: m.metadata.merchant?.name,
    amount: m.amount,
    intervalLabel: m.interval_label,
    spendingCap: m.spending_cap,
    status: m.status,
    ipfsCid: m.ipfs_cid,
    ipfsMetadataUrl: computeIpfsMetadataUrl(m.ipfs_cid),
    createdAt: m.created_at,
    url: `/metadata/${m.merchant_address}/${m.id}`,
  }))

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(response, null, 2))
}

async function handleMetadataLegacyRedirect(config: RelayerConfig, id: string, res: ServerResponse) {
  // Look up the plan by id (unscoped) and redirect to the canonical merchant-scoped URL
  const metadata = await getPlanMetadata(config.databaseUrl, id)

  if (!metadata || metadata.status === 'draft') {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Metadata not found' }))
    return
  }

  const canonicalUrl = `/metadata/${metadata.merchant_address}/${metadata.id}`
  res.writeHead(302, { Location: canonicalUrl })
  res.end()
}

async function handleMetadata(config: RelayerConfig, id: string, merchantAddress: string, req: IncomingMessage, res: ServerResponse) {
  const metadata = await getPlanMetadata(config.databaseUrl, id, merchantAddress)

  // Public endpoint: drafts are hidden; active + archived are served
  if (!metadata || metadata.status === 'draft') {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Metadata not found' }))
    return
  }

  // Return full metadata (including billing) with _meta for DB-level info only
  // Deep copy merchant to avoid mutating cached DB objects
  const metadataResponse = {
    ...metadata.metadata,
    merchant: metadata.metadata.merchant ? { ...metadata.metadata.merchant } : undefined,
  }
  if (metadataResponse.merchant?.logo && !metadataResponse.merchant.logo.startsWith('http') && !metadataResponse.merchant.logo.startsWith('ipfs://')) {
    const publicLogoUrl = getLogos().publicUrl(metadataResponse.merchant.logo)
    if (publicLogoUrl) {
      metadataResponse.merchant.logo = publicLogoUrl
    } else {
      // Build absolute URL so logo works when fetched cross-origin (e.g. from checkout frontend)
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
      const proto = req.headers['x-forwarded-proto'] || 'https'
      metadataResponse.merchant.logo = `${proto}://${host}/logos/${metadataResponse.merchant.logo}`
    }
  }

  const response = {
    ...metadataResponse,
    _meta: {
      id: metadata.id,
      merchantAddress: metadata.merchant_address,
      ipfsCid: metadata.ipfs_cid,
      ipfsMetadataUrl: computeIpfsMetadataUrl(metadata.ipfs_cid),
      status: metadata.status,
      createdAt: metadata.created_at,
      updatedAt: metadata.updated_at,
    },
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(response, null, 2))
}

async function handleListPlans(config: RelayerConfig, merchantAddress: string, res: ServerResponse, status?: PlanStatus) {
  const plans = await getPlanMetadataByMerchant(config.databaseUrl, merchantAddress, status)

  const response = plans.map((p) => ({
    id: p.id,
    planName: p.metadata.plan?.name,
    description: p.metadata.plan?.description,
    tier: p.metadata.plan?.tier,
    amount: p.amount,
    intervalLabel: p.interval_label,
    spendingCap: p.spending_cap,
    status: p.status,
    ipfsCid: p.ipfs_cid,
    ipfsMetadataUrl: computeIpfsMetadataUrl(p.ipfs_cid),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }))

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(response, null, 2))
}

async function handleCreatePlan(
  config: RelayerConfig,
  merchantAddress: string,
  body: Record<string, unknown>,
  res: ServerResponse
) {
  // Extract optional top-level control fields
  const customId = body.id as string | undefined
  const status = (body.status as PlanStatus) ?? 'active'

  // Validate status
  if (status !== 'draft' && status !== 'active') {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Status on creation must be "draft" or "active"' }))
    return
  }

  // Validate custom ID if provided
  if (customId !== undefined) {
    if (typeof customId !== 'string' || !isValidPlanId(customId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid plan ID. Must match /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/' }))
      return
    }
  }

  // The body IS the metadata (minus control fields)
  const { id: _id, status: _status, ...metadataFields } = body
  const metadata = metadataFields as unknown as PlanMetadata

  // Validate required metadata fields
  const plan = metadata.plan as PlanMetadata['plan'] | undefined
  const merchant = metadata.merchant as PlanMetadata['merchant'] | undefined
  if (!plan?.name || !plan?.description || !merchant?.name) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      error: 'Missing required fields: plan.name, plan.description, merchant.name',
    }))
    return
  }

  // Validate billing if present
  if (metadata.billing) {
    const billingResult = validateBilling(metadata.billing as unknown as Record<string, unknown>)
    if (!billingResult.valid) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: billingResult.error }))
      return
    }
    // Default currency to USDC
    if (!metadata.billing.currency) {
      metadata.billing.currency = 'USDC'
    }
  }

  if (!metadata.version) {
    metadata.version = '1.0'
  }

  const id = customId ?? randomUUID()

  // If requesting active and Storacha is configured, insert as draft first,
  // then promote to active only after IPFS upload succeeds.
  const needsIpfs = status === 'active' && isStorachaEnabled()
  const insertStatus: PlanStatus = needsIpfs ? 'draft' : status

  // Atomic insert — returns false if ID already exists (no race condition)
  const inserted = await insertPlanMetadata(config.databaseUrl, id, merchantAddress, metadata, insertStatus)
  if (!inserted) {
    res.writeHead(409, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: `Plan ID "${id}" already exists` }))
    return
  }

  logger.info({ id, merchantAddress, status: needsIpfs ? 'draft (pending IPFS)' : status }, 'Created plan')

  // If activation requires IPFS, attempt upload then promote to active
  let ipfsCid: string | null = null
  let finalStatus: PlanStatus = needsIpfs ? 'draft' : status
  if (needsIpfs) {
    try {
      ipfsCid = await uploadPlanToIPFS(config.databaseUrl, id, merchantAddress, metadata, buildLogoResolver())
    } catch (err) {
      logger.error({ id, err }, 'IPFS upload failed; plan saved as draft')
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: 'IPFS upload failed. Plan saved as draft — activate via PATCH.',
        id, status: 'draft', detail: String(err),
      }))
      return
    }
    try {
      await updatePlanMetadata(config.databaseUrl, id, merchantAddress, metadata, 'active')
      finalStatus = 'active'
    } catch (err) {
      logger.error({ id, err }, 'Status promotion failed after IPFS upload; plan is draft with CID')
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: 'IPFS upload succeeded but status promotion failed. Plan is draft with CID — retry PATCH to activate.',
        id, status: 'draft', ipfsCid, detail: String(err),
      }))
      return
    }
  }

  res.writeHead(201, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    id,
    merchantAddress,
    status: finalStatus,
    metadata,
    ipfsCid,
    ipfsMetadataUrl: computeIpfsMetadataUrl(ipfsCid),
  }, null, 2))
}

async function handleGetPlan(
  config: RelayerConfig,
  planId: string,
  merchantAddress: string,
  res: ServerResponse
) {
  const plan = await getPlanMetadata(config.databaseUrl, planId, merchantAddress)

  if (!plan) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Plan not found' }))
    return
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    id: plan.id,
    merchantAddress: plan.merchant_address,
    metadata: plan.metadata,
    status: plan.status,
    amount: plan.amount,
    intervalLabel: plan.interval_label,
    spendingCap: plan.spending_cap,
    ipfsCid: plan.ipfs_cid,
    ipfsMetadataUrl: computeIpfsMetadataUrl(plan.ipfs_cid),
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
  }, null, 2))
}

async function handleUpdatePlan(
  config: RelayerConfig,
  planId: string,
  merchantAddress: string,
  body: Record<string, unknown>,
  res: ServerResponse
) {
  // Check plan exists and belongs to this merchant
  const existing = await getPlanMetadata(config.databaseUrl, planId, merchantAddress)
  if (!existing) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Plan not found' }))
    return
  }

  // Extract control fields
  const newStatus = body.status as string | undefined
  const { id: _id, status: _status, ...metadataFields } = body
  const metadata = metadataFields as unknown as PlanMetadata

  // Validate required metadata fields
  const plan = metadata.plan as PlanMetadata['plan'] | undefined
  const merchant = metadata.merchant as PlanMetadata['merchant'] | undefined
  if (!plan?.name || !plan?.description || !merchant?.name) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      error: 'Missing required fields: plan.name, plan.description, merchant.name',
    }))
    return
  }

  // Validate billing if present
  if (metadata.billing) {
    const billingResult = validateBilling(metadata.billing as unknown as Record<string, unknown>)
    if (!billingResult.valid) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: billingResult.error }))
      return
    }
    if (!metadata.billing.currency) {
      metadata.billing.currency = 'USDC'
    }
  }

  // Validate status
  if (newStatus && !VALID_STATUSES.includes(newStatus as PlanStatus)) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }))
    return
  }

  // Validate status transition if changing
  const targetStatus = (newStatus as PlanStatus) ?? existing.status
  if (newStatus && newStatus !== existing.status) {
    if (!STATUS_TRANSITIONS[existing.status]?.includes(newStatus as PlanStatus)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `Cannot transition from "${existing.status}" to "${newStatus}"` }))
      return
    }
  }

  if (!metadata.version) {
    metadata.version = existing.metadata.version || '1.0'
  }

  // Determine IPFS upload strategy:
  // - needsIpfs: upload required (no CID yet, or content changed on active plan)
  // - needsPromotionOnly: CID exists and is current, just promote status
  const contentChanged = existing.ipfs_cid && JSON.stringify(metadata) !== JSON.stringify(existing.metadata)
  const needsIpfs = targetStatus === 'active' && (!existing.ipfs_cid || contentChanged) && isStorachaEnabled()
  const needsPromotionOnly = targetStatus === 'active' && !!existing.ipfs_cid && !contentChanged && existing.status !== 'active'

  // Save metadata with safe status — defer activation when IPFS upload or promotion is pending
  const safeStatus: PlanStatus = (needsIpfs || needsPromotionOnly) ? existing.status : targetStatus
  const updated = await updatePlanMetadata(config.databaseUrl, planId, merchantAddress, metadata, safeStatus)
  if (!updated) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Plan not found or was deleted during update' }))
    return
  }

  logger.info({ planId, merchantAddress, status: safeStatus }, 'Updated plan metadata')

  let ipfsCid: string | null = existing.ipfs_cid
  let finalStatus: PlanStatus = safeStatus
  if (needsIpfs) {
    try {
      ipfsCid = await uploadPlanToIPFS(config.databaseUrl, planId, merchantAddress, metadata, buildLogoResolver())
    } catch (err) {
      logger.error({ planId, err }, 'IPFS upload failed; metadata saved but status not promoted')
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: 'IPFS upload failed. Metadata saved but status was not changed.',
        status: safeStatus, detail: String(err),
      }))
      return
    }
    // If already active, no promotion needed — just update CID
    if (existing.status === 'active') {
      finalStatus = 'active'
    } else {
      try {
        await updatePlanMetadata(config.databaseUrl, planId, merchantAddress, metadata, 'active')
        finalStatus = 'active'
      } catch (err) {
        logger.error({ planId, err }, 'Status promotion failed after IPFS upload')
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          error: 'IPFS upload succeeded but status promotion failed. Retry PATCH to activate.',
          status: safeStatus, ipfsCid, detail: String(err),
        }))
        return
      }
    }
  } else if (needsPromotionOnly) {
    try {
      await updatePlanMetadata(config.databaseUrl, planId, merchantAddress, metadata, 'active')
      finalStatus = 'active'
    } catch (err) {
      logger.error({ planId, err }, 'Status promotion failed')
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: 'Status promotion failed. Retry PATCH to activate.',
        status: safeStatus, ipfsCid: existing.ipfs_cid, detail: String(err),
      }))
      return
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    id: planId,
    updated: true,
    status: finalStatus,
    ipfsCid,
    ipfsMetadataUrl: computeIpfsMetadataUrl(ipfsCid),
  }, null, 2))
}

async function handlePatchPlan(
  config: RelayerConfig,
  planId: string,
  merchantAddress: string,
  body: Record<string, unknown>,
  res: ServerResponse
) {
  // Check plan exists and belongs to this merchant
  const existing = await getPlanMetadata(config.databaseUrl, planId, merchantAddress)
  if (!existing) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Plan not found' }))
    return
  }

  // Extract control fields
  const newStatus = body.status as string | undefined
  const { id: _id, status: _status, ...patchFields } = body

  // Validate status
  if (newStatus && !VALID_STATUSES.includes(newStatus as PlanStatus)) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }))
    return
  }

  // Validate status transition if changing
  const targetStatus = (newStatus as PlanStatus) ?? existing.status
  if (newStatus && newStatus !== existing.status) {
    if (!STATUS_TRANSITIONS[existing.status]?.includes(newStatus as PlanStatus)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `Cannot transition from "${existing.status}" to "${newStatus}"` }))
      return
    }
  }

  // Validate incoming billing patch fields (partial — not all required)
  if (patchFields.billing) {
    const partialResult = validateBillingPartial(patchFields.billing as Record<string, unknown>)
    if (!partialResult.valid) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: partialResult.error }))
      return
    }
  }

  // Deep merge patch fields into existing metadata
  const merged = Object.keys(patchFields).length > 0
    ? deepMerge(existing.metadata as unknown as Record<string, unknown>, patchFields) as unknown as PlanMetadata
    : existing.metadata

  // Validate merged billing has all required fields
  if (merged.billing) {
    const billingResult = validateBilling(merged.billing as unknown as Record<string, unknown>)
    if (!billingResult.valid) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: billingResult.error }))
      return
    }
    if (!merged.billing.currency) {
      merged.billing.currency = 'USDC'
    }
  }

  // Determine IPFS upload strategy:
  // - needsIpfs: upload required (no CID yet, or content changed on active plan)
  // - needsPromotionOnly: CID exists and is current, just promote status
  const contentChanged = existing.ipfs_cid && JSON.stringify(merged) !== JSON.stringify(existing.metadata)
  const needsIpfs = targetStatus === 'active' && (!existing.ipfs_cid || contentChanged) && isStorachaEnabled()
  const needsPromotionOnly = targetStatus === 'active' && !!existing.ipfs_cid && !contentChanged && existing.status !== 'active'

  // Save metadata with safe status — defer activation when IPFS upload or promotion is pending
  const safeStatus: PlanStatus = (needsIpfs || needsPromotionOnly) ? existing.status : targetStatus
  const updated = await updatePlanMetadata(config.databaseUrl, planId, merchantAddress, merged, safeStatus)
  if (!updated) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Plan not found or was deleted during update' }))
    return
  }

  logger.info({ planId, merchantAddress, status: safeStatus }, 'Patched plan metadata')

  let ipfsCid: string | null = existing.ipfs_cid
  let finalStatus: PlanStatus = safeStatus
  if (needsIpfs) {
    try {
      ipfsCid = await uploadPlanToIPFS(config.databaseUrl, planId, merchantAddress, merged, buildLogoResolver())
    } catch (err) {
      logger.error({ planId, err }, 'IPFS upload failed; metadata saved but status not promoted')
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: 'IPFS upload failed. Metadata saved but status was not changed.',
        status: safeStatus, detail: String(err),
      }))
      return
    }
    // If already active, no promotion needed — just update CID
    if (existing.status === 'active') {
      finalStatus = 'active'
    } else {
      try {
        await updatePlanMetadata(config.databaseUrl, planId, merchantAddress, merged, 'active')
        finalStatus = 'active'
      } catch (err) {
        logger.error({ planId, err }, 'Status promotion failed after IPFS upload')
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          error: 'IPFS upload succeeded but status promotion failed. Retry PATCH to activate.',
          status: safeStatus, ipfsCid, detail: String(err),
        }))
        return
      }
    }
  } else if (needsPromotionOnly) {
    try {
      await updatePlanMetadata(config.databaseUrl, planId, merchantAddress, merged, 'active')
      finalStatus = 'active'
    } catch (err) {
      logger.error({ planId, err }, 'Status promotion failed')
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: 'Status promotion failed. Retry PATCH to activate.',
        status: safeStatus, ipfsCid: existing.ipfs_cid, detail: String(err),
      }))
      return
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    id: planId,
    updated: true,
    status: finalStatus,
    metadata: merged,
    ipfsCid,
    ipfsMetadataUrl: computeIpfsMetadataUrl(ipfsCid),
  }, null, 2))
}

async function handleDeletePlan(
  config: RelayerConfig,
  planId: string,
  merchantAddress: string,
  res: ServerResponse
) {
  // Check plan exists and belongs to this merchant
  const existing = await getPlanMetadata(config.databaseUrl, planId, merchantAddress)
  if (!existing) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Plan not found' }))
    return
  }

  // Prevent deleting active plans — archive first
  if (existing.status === 'active') {
    res.writeHead(409, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Cannot delete an active plan. Archive it first.' }))
    return
  }

  await deletePlanMetadata(config.databaseUrl, planId, merchantAddress)

  logger.info({ planId, merchantAddress }, 'Deleted plan')

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    id: planId,
    deleted: true,
    status: existing.status,
    ipfsCid: existing.ipfs_cid,
    ipfsMetadataUrl: computeIpfsMetadataUrl(existing.ipfs_cid),
  }, null, 2))
}

async function handleLogoUpload(req: IncomingMessage, res: ServerResponse) {
  const contentType = (req.headers['content-type'] || '').split(';')[0].trim()
  if (!VALID_IMAGE_TYPES.has(contentType)) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: `Unsupported content type. Must be one of: ${[...VALID_IMAGE_TYPES].join(', ')}` }))
    return
  }

  let body: Buffer
  try {
    body = await parseRawBody(req)
  } catch (err) {
    res.writeHead(413, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: (err as Error).message }))
    return
  }

  if (body.length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Empty body' }))
    return
  }

  // Compress and resize: max 512x512, output as WebP
  let compressed: Buffer
  try {
    compressed = await sharp(body)
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
  } catch (err) {
    logger.error({ err }, 'Image compression failed')
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid image file' }))
    return
  }

  logger.info({ originalSize: body.length, compressedSize: compressed.length }, 'Logo compressed')

  const storage = getLogos()
  const filename = await storage.upload(compressed, 'image/webp')

  res.writeHead(201, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ filename }))
}

async function handleLogo(filename: string, res: ServerResponse) {
  const storage = getLogos()

  // If the backend provides a public URL, redirect to it
  const url = storage.publicUrl(filename)
  logger.info({ filename, publicUrl: url || 'none', backendType: url ? 'supabase' : 'local' }, 'handleLogo: resolving')
  if (url) {
    res.writeHead(302, { Location: url, 'Cache-Control': 'public, max-age=86400' })
    res.end()
    return
  }

  // Otherwise serve from the backend directly (local filesystem)
  const result = await storage.serve(filename)
  if (!result) {
    logger.warn({ filename }, 'handleLogo: file not found in backend')
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Logo not found' }))
    return
  }

  res.writeHead(200, {
    'Content-Type': result.contentType,
    'Cache-Control': 'public, max-age=86400',
  })
  res.end(result.data)
}

async function handleMerchantStats(
  config: RelayerConfig,
  merchantAddress: string,
  chainId: number | undefined,
  res: ServerResponse
) {
  const db = getDb(config.databaseUrl)
  const addr = merchantAddress.toLowerCase()

  // Active subscribers: count active policies for this merchant
  const subscriberQuery = chainId != null
    ? db`SELECT count(*)::int AS count FROM policies WHERE merchant = ${addr} AND chain_id = ${chainId} AND active = true`
    : db`SELECT count(*)::int AS count FROM policies WHERE merchant = ${addr} AND active = true`

  // Revenue + charge count: sum successful charges
  const revenueQuery = chainId != null
    ? db`
        SELECT coalesce(sum(c.amount::numeric), 0)::text AS total_revenue, count(*)::int AS charge_count
        FROM charges c
        JOIN policies p ON c.policy_id = p.id AND c.chain_id = p.chain_id
        WHERE p.merchant = ${addr} AND c.chain_id = ${chainId} AND c.status = 'success'
      `
    : db`
        SELECT coalesce(sum(c.amount::numeric), 0)::text AS total_revenue, count(*)::int AS charge_count
        FROM charges c
        JOIN policies p ON c.policy_id = p.id AND c.chain_id = p.chain_id
        WHERE p.merchant = ${addr} AND c.status = 'success'
      `

  const [subscriberResult, revenueResult] = await Promise.all([subscriberQuery, revenueQuery])

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    activeSubscribers: subscriberResult[0]?.count ?? 0,
    totalRevenue: revenueResult[0]?.total_revenue ?? '0',
    chargeCount: revenueResult[0]?.charge_count ?? 0,
  }))
}

async function handleMerchantCharges(
  config: RelayerConfig,
  merchantAddress: string,
  chainId: number,
  page: number,
  limit: number,
  res: ServerResponse
) {
  const { charges, total } = await getChargesByMerchant(
    config.databaseUrl,
    chainId,
    merchantAddress,
    page,
    limit
  )

  const response = charges.map((c) => ({
    id: c.id,
    policyId: c.policy_id,
    chainId: c.chain_id,
    payer: c.payer,
    merchant: c.merchant,
    amount: c.amount,
    protocolFee: c.protocol_fee,
    txHash: c.tx_hash,
    receiptCid: c.receipt_cid,
    completedAt: c.completed_at,
    createdAt: c.created_at,
  }))

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ charges: response, total, page, limit }))
}

export function startApiServer(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      logger.info({ port }, 'API server listening')
      resolve()
    })
    server.on('error', reject)
  })
}

export function stopApiServer(server: Server): Promise<void> {
  nonceRateLimiter.destroy()
  authRateLimiter.destroy()
  destroyAuthStore()
  return new Promise((resolve) => {
    server.close(() => {
      logger.info('API server stopped')
      resolve()
    })
  })
}
