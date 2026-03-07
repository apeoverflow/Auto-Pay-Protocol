import { geolocation, next } from '@vercel/functions'

/**
 * Vercel Edge Middleware — geoblocking.
 *
 * Runs at the edge before every request. Uses Vercel's built-in geolocation
 * to block users from sanctioned/restricted countries.
 *
 * Blocked users are redirected to /blocked.html (HTTP 451).
 *
 * NOTE: geolocation() returns undefined in local development — requests pass through.
 *
 * Country lists last reviewed: 2026-03-02
 * Review schedule: quarterly or on OFAC/OFSI updates
 */

// Hard-blocked: OFAC/OFSI/EU comprehensive sanctions + crypto-banned jurisdictions
const HARD_BLOCKED = new Set([
  'KP', 'IR', 'SY', 'RU', 'BY', 'CU', 'MM', 'VE',
  'SD', 'SS', 'SO', 'LY',
  'CN', 'DZ', 'BD', 'NP', 'BO',
])

// Soft-blocked: partial sanctions, crypto restrictions, FATF grey/black list
const SOFT_BLOCKED = new Set([
  'EG', 'MA', 'TN', 'QA', 'YE', 'IQ', 'LB', 'ZW',
  'CD', 'CF', 'ML', 'ET', 'NI', 'PK',
])

// Occupied Ukrainian territories (ISO 3166-2 region codes)
const BLOCKED_UA_REGIONS = new Set(['43', '14', '09'])

export default function middleware(request: Request) {
  const geo = geolocation(request)
  const country = geo?.country

  // If geolocation unavailable (local dev, unknown IP), allow through
  if (!country) {
    return next()
  }

  // Hard block
  if (HARD_BLOCKED.has(country)) {
    const url = new URL('/blocked.html', request.url)
    return Response.redirect(url)
  }

  // Soft block (fully blocked until compliance infrastructure exists)
  if (SOFT_BLOCKED.has(country)) {
    const url = new URL('/blocked.html', request.url)
    return Response.redirect(url)
  }

  // Check occupied Ukrainian territories
  if (country === 'UA' && geo?.region && BLOCKED_UA_REGIONS.has(geo.region)) {
    const url = new URL('/blocked.html', request.url)
    return Response.redirect(url)
  }

  return next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets|blocked\\.html).*)'],
}
