import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http'
import { readFile, stat } from 'fs/promises'
import { join, extname, dirname } from 'path'
import { fileURLToPath } from 'url'
import { getStatus } from '../db/index.js'
import { getPlanMetadata, listAllPlanMetadata } from '../db/metadata.js'
import { getEnabledChains, type RelayerConfig } from '../config.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('api')

// Get the relayer root directory (two levels up from src/api)
const __dirname = dirname(fileURLToPath(import.meta.url))
const RELAYER_ROOT = join(__dirname, '..', '..')

// MIME types for static files
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

// Get logos directory path
function getLogosDir(): string {
  return process.env.LOGOS_DIR || join(RELAYER_ROOT, 'logos')
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
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

    const { path } = parsePath(req.url || '/')

    try {
      // Root
      if (path === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          service: 'autopay-relayer',
          version: '0.1.0',
          endpoints: {
            health: '/health',
            metadata: '/metadata/:id',
            metadataList: '/metadata',
            logo: '/logos/:filename',
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

      // Get specific metadata
      const metadataMatch = path.match(/^\/metadata\/([^/]+)$/)
      if (metadataMatch && req.method === 'GET') {
        await handleMetadata(config, metadataMatch[1], res)
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
  const metadata = await listAllPlanMetadata(config.databaseUrl)

  const response = metadata.map((m) => ({
    id: m.id,
    merchantAddress: m.merchant_address,
    planName: m.metadata.plan?.name,
    merchantName: m.metadata.merchant?.name,
    createdAt: m.created_at,
    url: `/metadata/${m.id}`,
  }))

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(response, null, 2))
}

async function handleMetadata(config: RelayerConfig, id: string, res: ServerResponse) {
  const metadata = await getPlanMetadata(config.databaseUrl, id)

  if (!metadata) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Metadata not found' }))
    return
  }

  // If logo is a relative path, convert to full URL
  const metadataResponse = { ...metadata.metadata }
  if (metadataResponse.merchant?.logo && !metadataResponse.merchant.logo.startsWith('http')) {
    // Assume it's a filename in the logos directory
    metadataResponse.merchant.logo = `/logos/${metadataResponse.merchant.logo}`
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(metadataResponse, null, 2))
}

async function handleLogo(filename: string, res: ServerResponse) {
  // Sanitize filename to prevent directory traversal
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '')
  if (sanitized !== filename) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid filename' }))
    return
  }

  const logoPath = join(getLogosDir(), sanitized)
  const ext = extname(sanitized).toLowerCase()
  const mimeType = MIME_TYPES[ext]

  if (!mimeType) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unsupported file type' }))
    return
  }

  try {
    // Check file exists
    await stat(logoPath)
    const data = await readFile(logoPath)

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=86400', // 24 hour cache
    })
    res.end(data)
  } catch {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Logo not found' }))
  }
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
  return new Promise((resolve) => {
    server.close(() => {
      logger.info('API server stopped')
      resolve()
    })
  })
}
