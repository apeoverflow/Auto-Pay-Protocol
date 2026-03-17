import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http'
import { getDb, getStatus } from '../db/index.js'
import { getPoliciesByPayer } from '../db/policies.js'
import { getChargesByMerchant, getChargesByIdsForMerchant, getChargesByIdsForPayer, setChargeReceiptCid } from '../db/charges.js'
import { getPlanMetadata, getPlanMetadataByMerchant, listAllPlanMetadata, insertPlanMetadata, updatePlanMetadata, deletePlanMetadata, type PlanMetadata, type PlanStatus, VALID_SUBSCRIBER_FIELDS } from '../db/metadata.js'
import { insertSubscriberData, getSubscribersByMerchant } from '../db/subscribers.js'
import { createApiKey, validateApiKey, listApiKeys, revokeApiKey } from '../db/api-keys.js'
import { generateShortId, createCheckoutLink, getCheckoutLink, getCheckoutLinksByPlan, deleteCheckoutLink, type CheckoutLinkRow } from '../db/checkout-links.js'
import { generateMonthlyReport, type MonthlyReport } from '../reports/generate.js'
import { getReportsByMerchant, getReport, saveReport } from '../db/reports.js'
import { randomUUID } from 'crypto'
import { getEnabledChains, type RelayerConfig } from '../config.js'
import { createLogger } from '../utils/logger.js'
import { uploadPlanToIPFS } from '../lib/ipfs-upload.js'
import { isStorachaEnabled, ipfsGatewayUrl } from '../lib/storacha.js'
import { generateAndUploadReport, generateAndSaveReport } from '../reports/upload.js'
import { buildReceipt, uploadChargeReceipt } from '../reports/receipt.js'
import { handleNonceRequest, authenticateMerchant, destroyAuthStore } from './auth.js'
import { getMerchant, clearMerchantWebhook, updateMerchantWebhook } from '../db/merchants.js'
import { generateWebhookSecret } from '../webhooks/signer.js'
import { SlidingWindowRateLimiter, type RateLimitResult } from './rate-limit.js'
import { checkGeoblock, initGeoblock } from './geo-block.js'
import { getLogoStorage } from '../lib/logo-storage.js'
import sharp from 'sharp'

const logger = createLogger('api')

const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true'
const nonceRateLimiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 10 })
const authRateLimiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 60 })
const checkoutLinkRateLimiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 60 })
const payerQueryRateLimiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 120 })

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

// Rate limiter for API key validation attempts (prevents DB hammering)
const apiKeyRateLimiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 120 })

// Authenticate by per-merchant API key (sk_live_...).
// Returns the merchant address if valid and scoped to the given path address, null otherwise.
// Returns 'rate_limited' if the caller is being rate-limited.
async function authenticateByMerchantApiKey(
  req: IncomingMessage,
  res: ServerResponse,
  config: RelayerConfig,
  pathAddress: string
): Promise<string | null | 'rate_limited'> {
  const providedKey = req.headers['x-api-key'] as string | undefined
  if (!providedKey || !providedKey.startsWith('sk_live_')) return null
  // Rate-limit by IP before hitting the database
  const ip = getClientIp(req)
  const rateResult = apiKeyRateLimiter.check(ip)
  if (!rateResult.allowed) {
    sendRateLimited(res, rateResult)
    return 'rate_limited'
  }
  const result = await validateApiKey(config.databaseUrl, providedKey)
  if (!result) return null
  // Key must be scoped to the merchant in the URL path
  if (result.merchant !== pathAddress.toLowerCase()) return null
  return result.merchant
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

// Normalize merchant.logo: strip absolute URLs down to bare filename
// This prevents stale full URLs from being stored when the editor sends back
// the resolved URL it received from the metadata endpoint.
function sanitizeLogo(metadata: PlanMetadata): void {
  const logo = metadata.merchant?.logo
  if (!logo) return
  // If it's a full URL (http/https), extract just the filename
  if (logo.startsWith('http')) {
    try {
      const url = new URL(logo)
      const filename = url.pathname.split('/').pop()
      if (filename) {
        metadata.merchant.logo = filename
      }
    } catch { /* leave as-is */ }
  }
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

// Validate checkout subscriber field configuration
function validateCheckoutFields(checkout: Record<string, unknown>): { valid: true } | { valid: false; error: string } {
  const { requiredFields, optionalFields } = checkout
  if (requiredFields !== undefined) {
    if (!Array.isArray(requiredFields)) {
      return { valid: false, error: 'checkout.requiredFields must be an array' }
    }
    for (const f of requiredFields) {
      if (!VALID_SUBSCRIBER_FIELDS.includes(f)) {
        return { valid: false, error: `Invalid checkout field "${f}". Must be one of: ${VALID_SUBSCRIBER_FIELDS.join(', ')}` }
      }
    }
  }
  if (optionalFields !== undefined) {
    if (!Array.isArray(optionalFields)) {
      return { valid: false, error: 'checkout.optionalFields must be an array' }
    }
    for (const f of optionalFields) {
      if (!VALID_SUBSCRIBER_FIELDS.includes(f)) {
        return { valid: false, error: `Invalid checkout field "${f}". Must be one of: ${VALID_SUBSCRIBER_FIELDS.join(', ')}` }
      }
    }
  }
  // Check for overlap between required and optional
  if (requiredFields && optionalFields) {
    const overlap = (requiredFields as string[]).filter(f => (optionalFields as string[]).includes(f))
    if (overlap.length > 0) {
      return { valid: false, error: `Fields cannot appear in both requiredFields and optionalFields: ${overlap.join(', ')}` }
    }
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

// Convert a MonthlyReport to a simple Section,Key,Value CSV
function reportToCsv(report: MonthlyReport): string {
  const rows: string[] = ['Section,Key,Value']

  const add = (section: string, key: string, value: string | number) => {
    // Escape values containing commas or quotes
    const v = String(value)
    const escaped = v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
    rows.push(`${section},${key},${escaped}`)
  }

  add('Info', 'Merchant', report.merchant)
  add('Info', 'Chain ID', report.chainId)
  add('Info', 'Period', report.period)
  add('Info', 'Generated At', report.generatedAt)

  add('Revenue', 'Total Revenue', report.revenue.totalRevenue)
  add('Revenue', 'Protocol Fees', report.revenue.protocolFees)
  add('Revenue', 'Net Revenue', report.revenue.netRevenue)

  add('Charges', 'Total', report.charges.total)
  add('Charges', 'Successful', report.charges.successful)
  add('Charges', 'Failed', report.charges.failed)
  add('Charges', 'Failure Rate', report.charges.failureRate)

  add('Subscribers', 'Active', report.subscribers.active)
  add('Subscribers', 'New', report.subscribers.new)
  add('Subscribers', 'Cancelled', report.subscribers.cancelled)
  add('Subscribers', 'Cancelled By Failure', report.subscribers.cancelledByFailure)
  add('Subscribers', 'Churn Rate', report.subscribers.churnRate)

  if (report.topPlans) {
    for (const plan of report.topPlans) {
      add('Top Plans', plan.planId || 'N/A', `${plan.subscribers} subscribers / ${plan.revenue} revenue`)
    }
  }

  if (report.chargeReceipts && report.chargeReceipts.length > 0) {
    add('Receipts', 'Count', report.chargeReceipts.length)
  }

  return rows.join('\n') + '\n'
}

export async function createApiServer(config: RelayerConfig): Promise<Server> {
  // Pre-load GeoIP database for country-based request blocking
  await initGeoblock()

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    setCorsHeaders(res)

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Geoblock check — returns 451 for sanctioned/restricted countries
    if (checkGeoblock(req, res)) return

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
            merchantReports: '/merchants/:address/reports?chain_id=...',
            merchantReport: '/merchants/:address/reports/:period?chain_id=...',
            merchantReportGenerate: 'POST /merchants/:address/reports/generate',
            merchantReportCsv: '/merchants/:address/reports/:period/csv?chain_id=N',
            termsAccept: 'POST /terms/accept',
            termsCheck: '/terms/check/:address?version=...',
            subscribers: 'POST /subscribers',
            merchantSubscribers: '/merchants/:address/subscribers?chain_id=...',
            merchantWebhook: '/merchants/:address/webhook',
            merchantWebhookRotate: 'POST /merchants/:address/webhook/rotate-secret',
            merchantApiKeys: '/merchants/:address/api-keys',
            merchantApiKeyCreate: 'POST /merchants/:address/api-keys',
            merchantApiKeyRevoke: 'DELETE /merchants/:address/api-keys/:id',
            payerPolicies: '/payers/:address/policies?chain_id=N&active=true|false&page=1&limit=50',
            checkoutLinkResolve: '/checkout-links/:shortId',
            merchantCheckoutLinks: '/merchants/:address/checkout-links',
            merchantCheckoutLinkCreate: 'POST /merchants/:address/checkout-links',
            merchantCheckoutLinkDelete: 'DELETE /merchants/:address/checkout-links/:shortId',
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
        // Stats are aggregate-only (counts + totals), no PII — no auth required
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

      // Merchant receipt upload (on-demand IPFS upload for charge receipts)
      const merchantReceiptUploadMatch = path.match(/^\/merchants\/([^/]+)\/receipts\/upload$/)
      if (merchantReceiptUploadMatch && req.method === 'POST') {
        const address = merchantReceiptUploadMatch[1]
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
        if (!isStorachaEnabled()) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'IPFS uploads are not configured. Set STORACHA_PRINCIPAL_KEY and STORACHA_DELEGATION_PROOF.' }))
          return
        }
        const body = await parseBody(req)
        const chargeIds = body.chargeIds as number[] | undefined
        const chainId = body.chainId as number | undefined
        if (!Array.isArray(chargeIds) || chargeIds.length === 0 || !chargeIds.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0 && id <= 2_147_483_647)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'chargeIds must be a non-empty array of integers' }))
          return
        }
        if (chargeIds.length > 25) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Maximum 25 charge IDs per request' }))
          return
        }
        if (!chainId || typeof chainId !== 'number') {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'chainId is required and must be a number' }))
          return
        }
        const enabledChains = getEnabledChains(config)
        if (!enabledChains.some((c) => c.chainId === chainId)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: `chainId ${chainId} is not an enabled chain` }))
          return
        }
        await handleReceiptUpload(config, address, chargeIds, chainId, res)
        return
      }

      // Payer policies (public, no auth required)
      const payerPoliciesMatch = path.match(/^\/payers\/([^/]+)\/policies$/)
      if (payerPoliciesMatch && req.method === 'GET') {
        const address = payerPoliciesMatch[1]
        if (!isValidAddress(address)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid payer address' }))
          return
        }
        const rateResult = payerQueryRateLimiter.check(address.toLowerCase())
        if (!rateResult.allowed) { sendRateLimited(res, rateResult); return }
        const chainId = params.get('chain_id')
        if (!chainId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'chain_id query parameter is required' }))
          return
        }
        const activeParam = params.get('active')
        const active = activeParam === null ? null : activeParam === 'true'
        const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1)
        const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '50', 10) || 50))
        await handlePayerPolicies(config, address, parseInt(chainId, 10), active, page, limit, res)
        return
      }

      // Payer receipt upload (on-demand IPFS upload for charge receipts)
      const payerReceiptUploadMatch = path.match(/^\/payers\/([^/]+)\/receipts\/upload$/)
      if (payerReceiptUploadMatch && req.method === 'POST') {
        const address = payerReceiptUploadMatch[1]
        if (!isValidAddress(address)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid payer address' }))
          return
        }
        if (AUTH_ENABLED) {
          const rateResult = authRateLimiter.check(address.toLowerCase())
          if (!rateResult.allowed) { sendRateLimited(res, rateResult); return }
          const verified = await authenticateMerchant(req, res, address)
          if (!verified) return
        }
        if (!isStorachaEnabled()) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'IPFS uploads are not configured. Set STORACHA_PRINCIPAL_KEY and STORACHA_DELEGATION_PROOF.' }))
          return
        }
        const body = await parseBody(req)
        const chargeIds = body.chargeIds as number[] | undefined
        const chainId = body.chainId as number | undefined
        if (!Array.isArray(chargeIds) || chargeIds.length === 0 || !chargeIds.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0 && id <= 2_147_483_647)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'chargeIds must be a non-empty array of integers' }))
          return
        }
        if (chargeIds.length > 25) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Maximum 25 charge IDs per request' }))
          return
        }
        if (!chainId || typeof chainId !== 'number') {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'chainId is required and must be a number' }))
          return
        }
        const enabledChains = getEnabledChains(config)
        if (!enabledChains.some((c) => c.chainId === chainId)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: `chainId ${chainId} is not an enabled chain` }))
          return
        }
        await handlePayerReceiptUpload(config, address, chargeIds, chainId, res)
        return
      }

      // Merchant report generation (on-demand)
      const merchantReportGenMatch = path.match(/^\/merchants\/([^/]+)\/reports\/generate$/)
      if (merchantReportGenMatch && req.method === 'POST') {
        const address = merchantReportGenMatch[1]
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
        const chainId = body.chainId as number | undefined
        if (!chainId || typeof chainId !== 'number') {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'chainId is required and must be a number' }))
          return
        }
        // Validate chainId is an enabled chain
        const enabledChains = getEnabledChains(config)
        if (!enabledChains.some((c) => c.chainId === chainId)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: `chainId ${chainId} is not an enabled chain` }))
          return
        }
        // Validate period format (default to current month)
        let period = body.period as string | undefined
        if (!period) {
          const now = new Date()
          period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        }
        if (!/^\d{4}-\d{2}$/.test(period)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'period must be in YYYY-MM format' }))
          return
        }
        // Merchant can opt into IPFS upload per-report; defaults to true when Storacha is configured
        const wantsIpfs = body.uploadToIpfs !== false
        const useIpfs = wantsIpfs && isStorachaEnabled()
        try {
          const { cid } = useIpfs
            ? await generateAndUploadReport(config.databaseUrl, chainId, address, period)
            : await generateAndSaveReport(config.databaseUrl, chainId, address, period)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ cid, period, ipfsUrl: cid ? ipfsGatewayUrl(cid) : null }))
        } catch (err) {
          logger.error({ address, chainId, period, err }, 'Report generation failed')
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Report generation failed', detail: err instanceof Error ? err.message : String(err) }))
        }
        return
      }

      // Merchant report detail (auth-protected, returns full report JSON from DB)
      const merchantReportDetailMatch = path.match(/^\/merchants\/([^/]+)\/reports\/(\d{4}-\d{2})$/)
      if (merchantReportDetailMatch && req.method === 'GET') {
        const address = merchantReportDetailMatch[1]
        const period = merchantReportDetailMatch[2]
        if (!isValidAddress(address)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid merchant address' }))
          return
        }
        // Auth: per-merchant API key → signature auth
        const reportKeyAuth = await authenticateByMerchantApiKey(req, res, config, address)
        if (reportKeyAuth === 'rate_limited') return
        if (!reportKeyAuth && AUTH_ENABLED) {
          const rateResult = authRateLimiter.check(address.toLowerCase())
          if (!rateResult.allowed) { sendRateLimited(res, rateResult); return }
          const verified = await authenticateMerchant(req, res, address)
          if (!verified) return
        }
        const chainId = params.get('chain_id')
        if (!chainId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'chain_id query parameter is required' }))
          return
        }
        try {
          const chainIdNum = parseInt(chainId, 10)
          // Cache-first: check DB for cached report_json
          const cached = await getReport(config.databaseUrl, address, chainIdNum, period)
          let report: MonthlyReport
          if (cached?.report_json) {
            report = cached.report_json as MonthlyReport
          } else {
            report = await generateMonthlyReport(config.databaseUrl, chainIdNum, address.toLowerCase(), period)
            // Cache for future requests
            await saveReport(config.databaseUrl, address.toLowerCase(), chainIdNum, period, cached?.cid ?? null, report)
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(report))
        } catch (err) {
          logger.error({ address, period, err }, 'Failed to generate report data')
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Failed to generate report data', detail: err instanceof Error ? err.message : String(err) }))
        }
        return
      }

      // Merchant report CSV download (auth-protected)
      const merchantReportCsvMatch = path.match(/^\/merchants\/([^/]+)\/reports\/(\d{4}-\d{2})\/csv$/)
      if (merchantReportCsvMatch && req.method === 'GET') {
        const address = merchantReportCsvMatch[1]
        const period = merchantReportCsvMatch[2]
        if (!isValidAddress(address)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid merchant address' }))
          return
        }
        // Auth: per-merchant API key → signature auth
        const csvKeyAuth = await authenticateByMerchantApiKey(req, res, config, address)
        if (csvKeyAuth === 'rate_limited') return
        if (!csvKeyAuth && AUTH_ENABLED) {
          const rateResult = authRateLimiter.check(address.toLowerCase())
          if (!rateResult.allowed) { sendRateLimited(res, rateResult); return }
          const verified = await authenticateMerchant(req, res, address)
          if (!verified) return
        }
        const chainId = params.get('chain_id')
        if (!chainId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'chain_id query parameter is required' }))
          return
        }
        try {
          const chainIdNum = parseInt(chainId, 10)
          // Cache-first: use cached report_json if available
          const cached = await getReport(config.databaseUrl, address, chainIdNum, period)
          let report: MonthlyReport
          if (cached?.report_json) {
            report = cached.report_json as MonthlyReport
          } else {
            report = await generateMonthlyReport(config.databaseUrl, chainIdNum, address.toLowerCase(), period)
            await saveReport(config.databaseUrl, address.toLowerCase(), chainIdNum, period, cached?.cid ?? null, report)
          }
          const csv = reportToCsv(report)
          res.writeHead(200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="report-${address.toLowerCase()}-${period}.csv"`,
          })
          res.end(csv)
        } catch (err) {
          logger.error({ address, period, err }, 'CSV export failed')
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'CSV export failed', detail: err instanceof Error ? err.message : String(err) }))
        }
        return
      }

      // Merchant reports list (public)
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
          ipfsUrl: r.cid ? ipfsGatewayUrl(r.cid) : null,
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

      // Merchant API keys: create, list, revoke
      // Merchant webhook: rotate secret
      const webhookRotateMatch = path.match(/^\/merchants\/([^/]+)\/webhook\/rotate-secret$/)
      if (webhookRotateMatch && req.method === 'POST') {
        const address = webhookRotateMatch[1]
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
        const newSecret = generateWebhookSecret()
        const merchant = await getMerchant(config.databaseUrl, address)
        if (!merchant?.webhook_url) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'No webhook configured. Set a webhook URL first.' }))
          return
        }
        await updateMerchantWebhook(config.databaseUrl, address, merchant.webhook_url, newSecret)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ webhookSecret: newSecret }))
        return
      }

      // Merchant webhook: get, set, delete
      const webhookMatch = path.match(/^\/merchants\/([^/]+)\/webhook$/)
      if (webhookMatch) {
        const address = webhookMatch[1]
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

        if (req.method === 'GET') {
          const merchant = await getMerchant(config.databaseUrl, address)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            webhookUrl: merchant?.webhook_url ?? null,
            hasSecret: !!(merchant?.webhook_secret),
          }))
          return
        }

        if (req.method === 'PUT') {
          const body = await parseBody(req)
          const webhookUrl = typeof body.webhookUrl === 'string' ? body.webhookUrl.trim() : ''
          if (!webhookUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'webhookUrl is required' }))
            return
          }
          // Validate URL format: https required, or http://localhost for dev
          try {
            const parsed = new URL(webhookUrl)
            const isLocalDev = parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
            if (parsed.protocol !== 'https:' && !isLocalDev) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'webhookUrl must use HTTPS (or http://localhost for development)' }))
              return
            }
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'webhookUrl must be a valid URL' }))
            return
          }

          const existing = await getMerchant(config.databaseUrl, address)
          const isNew = !existing?.webhook_secret
          const secret = isNew ? generateWebhookSecret() : existing!.webhook_secret!
          await updateMerchantWebhook(config.databaseUrl, address, webhookUrl, secret)

          const response: Record<string, unknown> = { webhookUrl, isNew }
          if (isNew) {
            response.webhookSecret = secret
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(response))
          return
        }

        if (req.method === 'DELETE') {
          await clearMerchantWebhook(config.databaseUrl, address)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
          return
        }
      }

      const merchantApiKeysMatch = path.match(/^\/merchants\/([^/]+)\/api-keys$/)
      if (merchantApiKeysMatch) {
        const address = merchantApiKeysMatch[1]
        if (!isValidAddress(address)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid merchant address' }))
          return
        }

        // All API key management requires signature auth
        if (AUTH_ENABLED) {
          const rateResult = authRateLimiter.check(address.toLowerCase())
          if (!rateResult.allowed) { sendRateLimited(res, rateResult); return }
          const verified = await authenticateMerchant(req, res, address)
          if (!verified) return
        }

        if (req.method === 'POST') {
          const body = await parseBody(req)
          const label = typeof body.label === 'string' ? body.label.trim().slice(0, 100) : ''
          const result = await createApiKey(config.databaseUrl, address, label)
          res.writeHead(201, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))
          return
        }

        if (req.method === 'GET') {
          const keys = await listApiKeys(config.databaseUrl, address)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ keys }))
          return
        }
      }

      // Merchant API keys: revoke specific key
      const merchantApiKeyRevokeMatch = path.match(/^\/merchants\/([^/]+)\/api-keys\/(\d+)$/)
      if (merchantApiKeyRevokeMatch && req.method === 'DELETE') {
        const address = merchantApiKeyRevokeMatch[1]
        const keyId = parseInt(merchantApiKeyRevokeMatch[2], 10)
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
        const revoked = await revokeApiKey(config.databaseUrl, address, keyId)
        if (!revoked) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'API key not found or already revoked' }))
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
        return
      }

      // Terms acceptance: record signed acceptance
      if (path === '/terms/accept' && req.method === 'POST') {
        const clientIp = getClientIp(req)
        const ipRateResult = authRateLimiter.check(clientIp)
        if (!ipRateResult.allowed) { sendRateLimited(res, ipRateResult); return }

        const body = await parseBody(req)
        const { address, version, message, signature } = body as {
          address?: string; version?: string; message?: string; signature?: string
        }

        if (!address || typeof address !== 'string' || !isValidAddress(address)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'address must be a valid Ethereum address' }))
          return
        }
        if (!version || typeof version !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'version is required' }))
          return
        }
        if (!message || typeof message !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'message is required' }))
          return
        }
        if (!signature || typeof signature !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'signature is required' }))
          return
        }

        // Verify the signature matches the address
        const { verifyMessage } = await import('viem')
        const valid = await verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` })
        if (!valid) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid signature — does not match the provided address' }))
          return
        }

        // Store acceptance (upsert — re-signing same version replaces the old record)
        const db = getDb(config.databaseUrl)
        await db`
          INSERT INTO terms_acceptances (wallet_address, terms_version, message, signature, accepted_at)
          VALUES (${address.toLowerCase()}, ${version}, ${message}, ${signature}, NOW())
          ON CONFLICT (wallet_address, terms_version) DO UPDATE
          SET message = ${message}, signature = ${signature}, accepted_at = NOW()
        `

        logger.info({ address, version }, 'Terms acceptance recorded')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
        return
      }

      // Terms acceptance: check if a wallet has accepted a specific version
      const termsCheckMatch = path.match(/^\/terms\/check\/([^/]+)$/)
      if (termsCheckMatch && req.method === 'GET') {
        const address = termsCheckMatch[1]
        if (!isValidAddress(address)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid address' }))
          return
        }
        const version = params.get('version')
        if (!version) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'version query parameter is required' }))
          return
        }

        const db = getDb(config.databaseUrl)
        const rows = await db`
          SELECT accepted_at FROM terms_acceptances
          WHERE wallet_address = ${address.toLowerCase()} AND terms_version = ${version}
          LIMIT 1
        `
        const accepted = rows.length > 0
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ accepted, acceptedAt: accepted ? rows[0].accepted_at : null }))
        return
      }

      // Submit subscriber data (public, called by checkout after policy creation)
      if (path === '/subscribers' && req.method === 'POST') {
        // Rate-limit by IP first (before parsing body)
        const clientIp = getClientIp(req)
        const ipRateResult = authRateLimiter.check(clientIp)
        if (!ipRateResult.allowed) { sendRateLimited(res, ipRateResult); return }

        const body = await parseBody(req)
        const { policyId, chainId, payer, merchant, planId, planMerchant, formData } = body as {
          policyId?: string; chainId?: number; payer?: string; merchant?: string
          planId?: string; planMerchant?: string; formData?: unknown
        }

        if (!policyId || typeof policyId !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'policyId is required' }))
          return
        }
        if (!chainId || typeof chainId !== 'number') {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'chainId is required and must be a number' }))
          return
        }
        if (!payer || typeof payer !== 'string' || !isValidAddress(payer)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'payer must be a valid address' }))
          return
        }
        if (!merchant || typeof merchant !== 'string' || !isValidAddress(merchant)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'merchant must be a valid address' }))
          return
        }
        if (!formData || typeof formData !== 'object' || Array.isArray(formData)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'formData must be an object' }))
          return
        }
        // Validate formData keys are in the allowed set and values are strings
        for (const [key, val] of Object.entries(formData as Record<string, unknown>)) {
          if (!VALID_SUBSCRIBER_FIELDS.includes(key as never)) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: `Unknown field "${key}". Allowed: ${VALID_SUBSCRIBER_FIELDS.join(', ')}` }))
            return
          }
          if (typeof val !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: `formData.${key} must be a string` }))
            return
          }
        }

        // Also rate-limit by payer address
        const rateResult = authRateLimiter.check(payer.toLowerCase())
        if (!rateResult.allowed) { sendRateLimited(res, rateResult); return }

        // Verify policyId exists and payer/merchant match the policy record
        const db = getDb(config.databaseUrl)
        const policyRows = await db`
          SELECT id FROM policies
          WHERE id = ${policyId}
            AND chain_id = ${chainId}
            AND payer = ${payer.toLowerCase()}
            AND merchant = ${merchant.toLowerCase()}
        `
        if (policyRows.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Policy not found or payer/merchant mismatch' }))
          return
        }

        await insertSubscriberData(
          config.databaseUrl, policyId, chainId, payer, merchant,
          planId ?? null, planMerchant ?? null, formData as Record<string, string>
        )

        res.writeHead(201, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
        return
      }

      // Merchant subscribers list (auth-protected — uses signature or API key)
      const merchantSubscribersMatch = path.match(/^\/merchants\/([^/]+)\/subscribers$/)
      if (merchantSubscribersMatch && req.method === 'GET') {
        const address = merchantSubscribersMatch[1]
        if (!isValidAddress(address)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid merchant address' }))
          return
        }
        // Auth: per-merchant API key → global STATS_API_KEY → signature auth
        const merchantKeyAuthSubs = await authenticateByMerchantApiKey(req, res, config, address)
        if (merchantKeyAuthSubs === 'rate_limited') return
        if (!merchantKeyAuthSubs) {
          if (AUTH_ENABLED) {
            const statsApiKey = process.env.STATS_API_KEY
            const providedKey = req.headers['x-api-key'] as string | undefined
            const hasValidApiKey = statsApiKey && providedKey === statsApiKey
            if (!hasValidApiKey) {
              const rateResult = authRateLimiter.check(address.toLowerCase())
              if (!rateResult.allowed) { sendRateLimited(res, rateResult); return }
              const verified = await authenticateMerchant(req, res, address)
              if (!verified) return
            }
          }
        }
        const chainId = params.get('chain_id')
        if (!chainId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'chain_id query parameter is required' }))
          return
        }
        const planId = params.get('plan_id') || undefined
        const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1)
        const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '50', 10) || 50))

        const { subscribers, total } = await getSubscribersByMerchant(
          config.databaseUrl, address, parseInt(chainId, 10), planId, page, limit
        )

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          subscribers: subscribers.map((s) => ({
            policyId: s.policy_id,
            chainId: s.chain_id,
            payer: s.payer,
            planId: s.plan_id,
            formData: s.form_data,
            active: s.active,
            chargeAmount: s.charge_amount,
            intervalSeconds: s.interval_seconds,
            createdAt: s.created_at,
          })),
          total,
          page,
          limit,
        }))
        return
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

      // Public: resolve checkout link
      const checkoutLinkResolveMatch = path.match(/^\/checkout-links\/([^/]+)$/)
      if (checkoutLinkResolveMatch && req.method === 'GET') {
        // Rate limit public resolve endpoint (separate from auth nonce limiter)
        const resolveIp = getClientIp(req)
        const resolveRateResult = checkoutLinkRateLimiter.check(resolveIp)
        if (!resolveRateResult.allowed) {
          sendRateLimited(res, resolveRateResult)
          return
        }
        const shortId = checkoutLinkResolveMatch[1]
        // Validate shortId format (only characters from our alphabet, reasonable length)
        // Max 48 to accommodate slug prefix (24) + dash + random (8) with margin
        if (!/^[A-Za-z0-9_-]{1,48}$/.test(shortId)) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Checkout link not found' }))
          return
        }
        const link = await getCheckoutLink(config.databaseUrl, shortId)
        if (!link) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Checkout link not found' }))
          return
        }
        // Join with plan_metadata to get full plan data
        const plan = await getPlanMetadata(config.databaseUrl, link.plan_id, link.merchant_address)
        if (!plan || plan.status !== 'active') {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Plan not found or not active' }))
          return
        }

        // Use configured base URL (avoids relying on spoofable request headers)
        const relayerBaseUrl = process.env.RELAYER_BASE_URL
          || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
        const metadataUrl = `${relayerBaseUrl}/metadata/${link.merchant_address}/${link.plan_id}`
        const intervalSeconds = plan.metadata?.billing?.interval
          ? (({ seconds: 1, minutes: 60, daily: 86400, weekly: 604800, biweekly: 1209600, monthly: 2592000, quarterly: 7776000, yearly: 31536000 } as Record<string, number>)[plan.metadata.billing.interval] ?? 2592000)
          : 2592000

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          merchant: link.merchant_address,
          metadataUrl,
          amount: plan.metadata?.billing?.amount ?? plan.amount ?? '0',
          interval: intervalSeconds,
          spendingCap: plan.metadata?.billing?.cap ?? plan.spending_cap ?? undefined,
          ipfsMetadataUrl: computeIpfsMetadataUrl(plan.ipfs_cid),
          successUrl: link.success_url ?? undefined,
          cancelUrl: link.cancel_url ?? undefined,
          fields: link.fields ?? undefined,
        }))
        return
      }

      // Merchant checkout links: create / list
      const merchantCheckoutLinksMatch = path.match(/^\/merchants\/(0x[a-fA-F0-9]{40})\/checkout-links$/)
      if (merchantCheckoutLinksMatch && req.method === 'POST') {
        const address = merchantCheckoutLinksMatch[1]
        // Auth: per-merchant API key → signature auth
        const keyAuth = await authenticateByMerchantApiKey(req, res, config, address)
        if (keyAuth === 'rate_limited') return
        if (!keyAuth) {
          if (AUTH_ENABLED) {
            const rateResult = authRateLimiter.check(address.toLowerCase())
            if (!rateResult.allowed) { sendRateLimited(res, rateResult); return }
            const verified = await authenticateMerchant(req, res, address)
            if (!verified) return
          }
        }
        const body = await parseBody(req)
        const planId = body.planId as string | undefined
        if (!planId || typeof planId !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'planId is required' }))
          return
        }
        // Validate plan exists and is active
        const plan = await getPlanMetadata(config.databaseUrl, planId, address)
        if (!plan || plan.status !== 'active') {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Plan not found or not active' }))
          return
        }
        const successUrl = typeof body.successUrl === 'string' ? body.successUrl : undefined
        const cancelUrl = typeof body.cancelUrl === 'string' ? body.cancelUrl : undefined
        // Validate redirect URLs to prevent open redirects
        for (const [label, url] of [['successUrl', successUrl], ['cancelUrl', cancelUrl]] as const) {
          if (url) {
            try {
              const parsed = new URL(url)
              if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: `${label} must use http or https protocol` }))
                return
              }
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: `${label} is not a valid URL` }))
              return
            }
          }
        }
        const fields = typeof body.fields === 'string' ? body.fields : undefined
        // Validate fields length
        if (fields && fields.length > 256) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'fields value too long (max 256 characters)' }))
          return
        }
        // Enforce per-merchant link limit to prevent unbounded growth
        const db = getDb(config.databaseUrl)
        const [{ count: linkCount }] = await db<[{ count: number }]>`SELECT COUNT(*)::int AS count FROM checkout_links WHERE merchant_address = ${address.toLowerCase()}`
        if (linkCount >= 500) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Maximum checkout links reached (500). Delete unused links first.' }))
          return
        }
        // Optional base slug for the short ID (e.g. "autopay" → "autopay-xK9mZaBc")
        const slug = typeof body.slug === 'string' ? body.slug.trim() : undefined
        if (slug) {
          if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,23}$/.test(slug)) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Base slug must be 1-24 alphanumeric characters (plus - and _), starting with a letter or number' }))
            return
          }
        }

        // Generate short ID with atomic insert + collision retry (up to 3 attempts)
        // On each collision, grow the random suffix by 1 char for more entropy
        const baseRandomLength = 8
        let shortId: string | null = null
        for (let attempt = 0; attempt < 3; attempt++) {
          const randomPart = generateShortId(baseRandomLength + attempt)
          const candidate = slug ? `${slug}-${randomPart}` : randomPart
          try {
            await createCheckoutLink(config.databaseUrl, candidate, planId, address, { successUrl, cancelUrl, fields })
            shortId = candidate
            break
          } catch (err: unknown) {
            // Retry on unique constraint violation (PK collision), rethrow others
            const pgErr = err as { code?: string }
            if (pgErr.code !== '23505') throw err
            logger.warn({ candidate, attempt, suffixLength: baseRandomLength + attempt }, 'Short ID collision, retrying with longer suffix')
          }
        }
        if (!shortId) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Failed to generate unique short ID' }))
          return
        }
        res.writeHead(201, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ shortId, planId, merchantAddress: address.toLowerCase(), successUrl, cancelUrl, fields }))
        return
      }

      // Merchant checkout links: list
      if (merchantCheckoutLinksMatch && req.method === 'GET') {
        const address = merchantCheckoutLinksMatch[1]
        // Auth: per-merchant API key → signature auth
        const keyAuth = await authenticateByMerchantApiKey(req, res, config, address)
        if (keyAuth === 'rate_limited') return
        if (!keyAuth) {
          if (AUTH_ENABLED) {
            const rateResult = authRateLimiter.check(address.toLowerCase())
            if (!rateResult.allowed) { sendRateLimited(res, rateResult); return }
            const verified = await authenticateMerchant(req, res, address)
            if (!verified) return
          }
        }
        const planId = params.get('plan_id')
        let links: CheckoutLinkRow[]
        if (planId) {
          links = await getCheckoutLinksByPlan(config.databaseUrl, planId, address)
        } else {
          const listDb = getDb(config.databaseUrl)
          links = (await listDb`SELECT * FROM checkout_links WHERE merchant_address = ${address.toLowerCase()} ORDER BY created_at DESC LIMIT 500`) as unknown as CheckoutLinkRow[]
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(links.map((l) => ({
          shortId: l.short_id,
          planId: l.plan_id,
          merchantAddress: l.merchant_address,
          successUrl: l.success_url,
          cancelUrl: l.cancel_url,
          fields: l.fields,
          createdAt: l.created_at,
        }))))
        return
      }

      // Merchant checkout links: delete
      const merchantCheckoutLinkDeleteMatch = path.match(/^\/merchants\/(0x[a-fA-F0-9]{40})\/checkout-links\/([^/]+)$/)
      if (merchantCheckoutLinkDeleteMatch && req.method === 'DELETE') {
        const address = merchantCheckoutLinkDeleteMatch[1]
        const shortId = merchantCheckoutLinkDeleteMatch[2]
        // Auth: per-merchant API key → signature auth
        const keyAuth = await authenticateByMerchantApiKey(req, res, config, address)
        if (keyAuth === 'rate_limited') return
        if (!keyAuth) {
          if (AUTH_ENABLED) {
            const rateResult = authRateLimiter.check(address.toLowerCase())
            if (!rateResult.allowed) { sendRateLimited(res, rateResult); return }
            const verified = await authenticateMerchant(req, res, address)
            if (!verified) return
          }
        }
        if (!/^[A-Za-z0-9_-]{1,48}$/.test(shortId)) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Checkout link not found' }))
          return
        }
        const deleted = await deleteCheckoutLink(config.databaseUrl, shortId, address)
        if (!deleted) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Checkout link not found' }))
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ deleted: true }))
        return
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    } catch (error) {
      logger.error({ error, path }, 'API error')
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Internal server error' }))
      }
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

  // Normalize logo: always store bare filename, never absolute URLs
  sanitizeLogo(metadata)

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

  // Validate checkout fields if present
  if (metadata.checkout) {
    const checkoutValidation = validateCheckoutFields(metadata.checkout)
    if (!checkoutValidation.valid) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: checkoutValidation.error }))
      return
    }
  }

  if (!metadata.version) {
    metadata.version = '1.0'
  }

  // Enforce max 2 non-archived plans per merchant
  const MAX_PLANS_PER_MERCHANT = 2
  const existingPlans = await getPlanMetadataByMerchant(config.databaseUrl, merchantAddress)
  const activePlanCount = existingPlans.filter(p => p.status !== 'archived').length
  if (activePlanCount >= MAX_PLANS_PER_MERCHANT) {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      error: `Plan limit reached. Each merchant account is limited to ${MAX_PLANS_PER_MERCHANT} active plans. Archive an existing plan to create a new one.`,
    }))
    return
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

  // Normalize logo: always store bare filename, never absolute URLs
  sanitizeLogo(metadata)

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

  // Validate checkout fields if present
  if (metadata.checkout) {
    const checkoutValidation = validateCheckoutFields(metadata.checkout)
    if (!checkoutValidation.valid) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: checkoutValidation.error }))
      return
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

    // Enforce plan limit when re-activating an archived plan
    if (existing.status === 'archived' && (newStatus === 'active' || newStatus === 'draft')) {
      const MAX_PLANS_PER_MERCHANT = 2
      const allPlans = await getPlanMetadataByMerchant(config.databaseUrl, merchantAddress)
      const activePlanCount = allPlans.filter(p => p.status !== 'archived' && p.id !== planId).length
      if (activePlanCount >= MAX_PLANS_PER_MERCHANT) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          error: `Plan limit reached. Each merchant account is limited to ${MAX_PLANS_PER_MERCHANT} active plans. Archive an existing plan first.`,
        }))
        return
      }
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
  if (url) {
    res.writeHead(302, { Location: url, 'Cache-Control': 'public, max-age=86400' })
    res.end()
    return
  }

  // Otherwise serve from the backend directly (local filesystem)
  const result = await storage.serve(filename)
  if (!result) {
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

async function handlePayerPolicies(
  config: RelayerConfig,
  payerAddress: string,
  chainId: number,
  active: boolean | null,
  page: number,
  limit: number,
  res: ServerResponse
) {
  const { policies, total } = await getPoliciesByPayer(
    config.databaseUrl,
    chainId,
    payerAddress,
    active,
    page,
    limit
  )

  const response = policies.map((p) => ({
    policyId: p.id,
    chainId: p.chain_id,
    merchant: p.merchant,
    chargeAmount: p.charge_amount,
    spendingCap: p.spending_cap,
    totalSpent: p.total_spent,
    intervalSeconds: p.interval_seconds,
    active: p.active,
    chargeCount: p.charge_count,
    consecutiveFailures: p.consecutive_failures,
    metadataUrl: p.metadata_url,
    createdAt: p.created_at,
    nextChargeAt: p.next_charge_at,
  }))

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ policies: response, total, page, limit }))
}

async function processReceiptUploads(
  config: RelayerConfig,
  charges: import('../db/charges.js').ReceiptUploadChargeRow[],
  chargeIds: number[],
  res: ServerResponse
) {
  // Build a set of found charge IDs for quick lookup
  const foundIds = new Set(charges.map((c) => c.id))

  // IDs that don't belong to this caller or aren't successful
  const invalidIds = chargeIds.filter((id) => !foundIds.has(id))

  // Split into already-uploaded (skip) and needs-upload
  const skipped: number[] = []
  const toUpload = charges.filter((c) => {
    if (c.receipt_cid) {
      skipped.push(c.id)
      return false
    }
    return true
  })

  const uploaded: { chargeId: number; cid: string; ipfsUrl: string }[] = []
  const failed: { chargeId: number; error: string }[] = []

  for (const charge of toUpload) {
    try {
      const receipt = buildReceipt({
        policyId: charge.policy_id,
        payer: charge.payer,
        merchant: charge.merchant,
        amount: charge.amount,
        protocolFee: charge.protocol_fee ?? '0',
        chainId: charge.chain_id,
        txHash: charge.tx_hash,
        metadataUrl: charge.metadata_url,
        timestamp: charge.completed_at?.toISOString(),
      })
      const cid = await uploadChargeReceipt(receipt)
      await setChargeReceiptCid(config.databaseUrl, charge.id, cid)
      uploaded.push({ chargeId: charge.id, cid, ipfsUrl: `https://w3s.link/ipfs/${cid}` })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.warn({ chargeId: charge.id, err: message }, 'Receipt upload failed')
      failed.push({ chargeId: charge.id, error: message })
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ uploaded, skipped, failed, invalidIds }))
}

async function handleReceiptUpload(
  config: RelayerConfig,
  merchantAddress: string,
  chargeIds: number[],
  chainId: number,
  res: ServerResponse
) {
  const charges = await getChargesByIdsForMerchant(
    config.databaseUrl,
    chargeIds,
    merchantAddress,
    chainId
  )
  await processReceiptUploads(config, charges, chargeIds, res)
}

async function handlePayerReceiptUpload(
  config: RelayerConfig,
  payerAddress: string,
  chargeIds: number[],
  chainId: number,
  res: ServerResponse
) {
  const charges = await getChargesByIdsForPayer(
    config.databaseUrl,
    chargeIds,
    payerAddress,
    chainId
  )
  await processReceiptUploads(config, charges, chargeIds, res)
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
  checkoutLinkRateLimiter.destroy()
  destroyAuthStore()
  return new Promise((resolve) => {
    server.close(() => {
      logger.info('API server stopped')
      resolve()
    })
  })
}
