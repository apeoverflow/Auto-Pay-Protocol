import type { IncomingMessage, ServerResponse } from 'http'
import { http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { Handler } from 'tempo.ts/server'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('api:fee-payer')

const TEMPO_CHAIN_ID = 4217
const USDC_E = '0x20c000000000000000000000b9537d11c60e8b50' as const

// Contracts that we allow fee sponsorship for — anything else is rejected
const ALLOWED_CONTRACTS = new Set([
  '0x20c000000000000000000000b9537d11c60e8b50', // USDC.e (approve)
  '0x5edaf928c94a249c5ce1eabad0fe799cd294f345', // PolicyManager
])

// Rate limiting: per-IP, single check at the HTTP layer only
const ipRequests = new Map<string, { count: number; resetAt: number }>()
const MAX_REQUESTS_PER_MINUTE = 30

// Daily spending tracker
let dailyGasSpent = 0
let dailyResetAt = Date.now() + 86_400_000
const DAILY_CAP_MICRO_USD = 50_000_000 // $50 in 6-decimal USD

function getIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  return req.socket.remoteAddress || 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = ipRequests.get(ip)
  if (!entry || now > entry.resetAt) {
    ipRequests.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }
  entry.count++
  return entry.count > MAX_REQUESTS_PER_MINUTE
}

function isDailyCapExceeded(): boolean {
  const now = Date.now()
  if (now > dailyResetAt) {
    dailyGasSpent = 0
    dailyResetAt = now + 86_400_000
  }
  return dailyGasSpent >= DAILY_CAP_MICRO_USD
}

export function createFeePayerHandler(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey)

  logger.info({ address: account.address }, 'Fee payer account configured')

  const handler = Handler.feePayer({
    account,
    chain: {
      id: TEMPO_CHAIN_ID,
      name: 'Tempo',
      nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 6 },
      rpcUrls: { default: { http: [process.env.TEMPO_RPC || 'https://rpc.tempo.xyz'] } },
      feeToken: USDC_E,
    } as any,
    transport: http(process.env.TEMPO_RPC || 'https://rpc.tempo.xyz'),
    // No CORS here — the outer HTTP server handles CORS via setCorsHeaders()
    // This avoids double-setting headers and potential override conflicts
  })

  return handler
}

/** Mount fee payer on the existing HTTP server under /fee-payer path */
export function handleFeePayerRequest(
  handler: ReturnType<typeof createFeePayerHandler>,
  req: IncomingMessage,
  res: ServerResponse,
) {
  // Rate limit — single check at HTTP layer only (not duplicated in onRequest)
  const ip = getIp(req)
  if (isRateLimited(ip)) {
    logger.warn({ ip }, 'Fee payer rate limited')
    res.writeHead(429, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Rate limited' }))
    return
  }

  // Daily spending cap
  if (isDailyCapExceeded()) {
    logger.warn('Fee payer daily cap exceeded')
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Fee sponsorship temporarily unavailable' }))
    return
  }

  const fetchHandler = handler.fetch
  if (!fetchHandler) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Fee payer not configured' }))
    return
  }

  // Convert Node.js request to Fetch API Request
  let body = ''
  req.on('data', (chunk: Buffer) => { body += chunk.toString() })
  req.on('end', async () => {
    try {
      const url = `http://localhost${req.url || '/'}`
      const fetchReq = new Request(url, {
        method: req.method || 'POST',
        headers: Object.fromEntries(
          Object.entries(req.headers)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v!])
        ),
        body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
      })

      const fetchRes = await fetchHandler(fetchReq)
      const resBody = await fetchRes.text()

      // Copy tempo.ts response headers, but skip CORS (handled by outer setCorsHeaders)
      fetchRes.headers.forEach((v, k) => {
        if (!k.toLowerCase().startsWith('access-control-')) {
          res.setHeader(k, v)
        }
      })
      res.writeHead(fetchRes.status)
      res.end(resBody)
    } catch (err: any) {
      logger.error({ err: err.message }, 'Fee payer error')
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message || 'Internal error' }))
    }
  })
}
