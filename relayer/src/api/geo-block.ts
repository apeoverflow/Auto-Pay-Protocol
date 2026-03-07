import type { IncomingMessage, ServerResponse } from 'http'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('geoblock')

/**
 * IP-based geoblocking for the relayer API.
 *
 * Resolution order for country code:
 * 1. Trusted proxy headers (only if GEOBLOCK_TRUST_PROXY is set)
 *    - CF-IPCountry (Cloudflare)
 *    - X-Vercel-IP-Country (Vercel)
 * 2. geoip-lite offline database lookup (always available)
 *
 * Env vars:
 * - GEOBLOCK_ENABLED: true (default) | false
 * - GEOBLOCK_TRUST_PROXY: "cloudflare" | "vercel" | unset
 *   Only trust country headers from the named proxy. If unset, headers are
 *   ignored and only geoip-lite is used (safest — no spoofing possible).
 *
 * Country lists last reviewed: 2026-03-03
 * Review schedule: quarterly or on OFAC/OFSI updates
 */

// --- Country lists ---

/** OFAC/OFSI/EU comprehensive sanctions + crypto-banned jurisdictions */
const HARD_BLOCKED = new Set([
  'KP', 'IR', 'SY', 'RU', 'BY', 'CU', 'MM', 'VE',
  'SD', 'SS', 'SO', 'LY',
  'CN', 'DZ', 'BD', 'NP', 'BO',
])

/** Partial sanctions, crypto restrictions, FATF grey/black list */
const SOFT_BLOCKED = new Set([
  'EG', 'MA', 'TN', 'QA', 'YE', 'IQ', 'LB', 'ZW',
  'CD', 'CF', 'ML', 'ET', 'NI', 'PK',
])

// --- geoip-lite lazy loader (ESM-safe) ---

let geoLookup: ((ip: string) => { country: string } | null) | null = null
let geoLoadAttempted = false

async function loadGeoIP(): Promise<void> {
  if (geoLoadAttempted) return
  geoLoadAttempted = true
  try {
    const geoip = await import('geoip-lite')
    geoLookup = (geoip.default?.lookup ?? geoip.lookup).bind(geoip.default ?? geoip)
    logger.info('geoip-lite database loaded')
  } catch {
    logger.warn('geoip-lite not available — falling back to header-only geoblocking')
  }
}

/** Call once at startup to pre-load the GeoIP database. */
export async function initGeoblock(): Promise<void> {
  await loadGeoIP()
  const trustProxy = process.env.GEOBLOCK_TRUST_PROXY
  if (trustProxy) {
    logger.info({ trustProxy }, 'Geoblocking trusts proxy headers from: %s', trustProxy)
  } else if (geoLookup) {
    logger.info('Geoblocking using geoip-lite (no proxy headers trusted)')
  } else {
    logger.warn('Geoblocking has no country resolution available — all requests will pass through')
  }
}

// --- Helpers ---

/** Extract client IP from request, respecting proxy headers. */
function getClientIpForGeo(req: IncomingMessage): string {
  const trustProxy = process.env.GEOBLOCK_TRUST_PROXY

  // Only trust CF-Connecting-IP if behind Cloudflare
  if (trustProxy === 'cloudflare') {
    const cfIp = req.headers['cf-connecting-ip']
    if (typeof cfIp === 'string') return cfIp.trim()
  }

  // Standard proxy header (first IP in chain)
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string') return xff.split(',')[0].trim()

  return req.socket.remoteAddress || ''
}

/** Resolve country code from request headers or IP lookup. */
function resolveCountry(req: IncomingMessage): string | null {
  const trustProxy = process.env.GEOBLOCK_TRUST_PROXY

  // 1. Trusted proxy headers only
  if (trustProxy === 'cloudflare') {
    const cfCountry = req.headers['cf-ipcountry']
    if (typeof cfCountry === 'string' && cfCountry.length === 2) {
      return cfCountry.toUpperCase()
    }
  } else if (trustProxy === 'vercel') {
    const vercelCountry = req.headers['x-vercel-ip-country']
    if (typeof vercelCountry === 'string' && vercelCountry.length === 2) {
      return vercelCountry.toUpperCase()
    }
  }
  // If trustProxy is set but header is missing, fall through to geoip-lite

  // 2. geoip-lite offline lookup (not spoofable)
  if (geoLookup) {
    const ip = getClientIpForGeo(req)
    if (isPrivateIP(ip)) return null
    const result = geoLookup(ip)
    if (result?.country) {
      return result.country.toUpperCase()
    }
  }

  return null
}

/** Check if IP is private/local (should not be geo-looked up). */
function isPrivateIP(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.2') ||
    ip.startsWith('172.3') ||
    ip.startsWith('fc') ||
    ip.startsWith('fd')
  )
}

/** Returns true if the country is blocked (hard or soft). */
function isBlocked(country: string): boolean {
  return HARD_BLOCKED.has(country) || SOFT_BLOCKED.has(country)
}

// --- Middleware ---

/** Whether geoblocking is enabled. Default: true. Set GEOBLOCK_ENABLED=false to disable. */
export function isGeoblockEnabled(): boolean {
  const val = process.env.GEOBLOCK_ENABLED
  if (val === undefined || val === '') return true
  return val === 'true' || val === '1'
}

/**
 * Check if request should be geoblocked. Returns true if blocked (response already sent).
 *
 * Usage in the request handler:
 * ```
 * if (checkGeoblock(req, res)) return
 * ```
 */
export function checkGeoblock(req: IncomingMessage, res: ServerResponse): boolean {
  if (!isGeoblockEnabled()) return false

  const country = resolveCountry(req)
  if (!country) return false // Unknown country — fail open

  if (isBlocked(country)) {
    const ip = getClientIpForGeo(req)
    logger.info({ country, ip }, 'Blocked request from restricted country')
    res.writeHead(451, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      error: 'Service unavailable in your region',
      code: 'GEO_BLOCKED',
    }))
    return true
  }

  return false
}
