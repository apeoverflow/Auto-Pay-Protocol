import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http'
import { getStatus } from '../db/index.js'
import { getEnabledChains, type RelayerConfig } from '../config.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('api:health')

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  chains: Record<
    number,
    {
      name: string
      lastIndexedBlock: number | null
      activePolicies: number
      pendingCharges: number
      healthy: boolean
    }
  >
  executor: {
    healthy: boolean
  }
  webhooks: {
    pending: number
    failed: number
  }
}

export async function createHealthServer(
  config: RelayerConfig
): Promise<Server> {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/health' && req.method === 'GET') {
      try {
        const dbStatus = await getStatus(config.databaseUrl)
        const enabledChains = getEnabledChains(config)

        const response: HealthResponse = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          chains: {},
          executor: { healthy: true },
          webhooks: dbStatus.webhooks,
        }

        // Check each chain's health
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

        // Check webhook health
        if (dbStatus.webhooks.failed > 10) {
          response.status = 'degraded'
        }

        res.writeHead(response.status === 'healthy' ? 200 : 503, {
          'Content-Type': 'application/json',
        })
        res.end(JSON.stringify(response, null, 2))
      } catch (error) {
        logger.error({ error }, 'Health check failed')
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'unhealthy', error: 'Internal error' }))
      }
    } else if (req.url === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ service: 'autopay-relayer', version: '0.1.0' }))
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    }
  })

  return server
}

export function startHealthServer(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      logger.info({ port }, 'Health server listening')
      resolve()
    })
    server.on('error', reject)
  })
}

export function stopHealthServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      logger.info('Health server stopped')
      resolve()
    })
  })
}
