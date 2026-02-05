import { loadConfig, getEnabledChains } from './config.js'
import { runMigrations } from './db/migrations/index.js'
import { closeDb } from './db/index.js'
import { startIndexerLoop } from './indexer/index.js'
import { startExecutorLoop } from './executor/index.js'
import { startWebhookSenderLoop } from './webhooks/index.js'
import { createHealthServer, startHealthServer, stopHealthServer } from './api/health.js'
import { createLogger } from './utils/logger.js'

const logger = createLogger('relayer')

export async function startRelayer() {
  logger.info('Starting AutoPay relayer...')

  const config = loadConfig()

  // Run migrations
  logger.info('Running database migrations...')
  await runMigrations(config.databaseUrl)

  // Start health server
  const healthServer = await createHealthServer(config)
  await startHealthServer(healthServer, config.port)

  // Create abort controller for graceful shutdown
  const abortController = new AbortController()

  // Handle shutdown signals
  const shutdown = async () => {
    logger.info('Shutting down...')
    abortController.abort()
    await stopHealthServer(healthServer)
    await closeDb()
    logger.info('Shutdown complete')
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Start services for each enabled chain
  const enabledChains = getEnabledChains(config)
  logger.info(
    { chains: enabledChains.map((c) => c.name) },
    'Starting services for enabled chains'
  )

  // Start indexer loops (one per chain)
  const indexerPromises = enabledChains.map((chainConfig) =>
    startIndexerLoop(
      chainConfig,
      config.databaseUrl,
      chainConfig.pollIntervalMs,
      abortController.signal
    )
  )

  // Start executor loop (handles all chains)
  const executorPromise = startExecutorLoop(config, abortController.signal)

  // Start webhook sender loop
  const webhookPromise = startWebhookSenderLoop(config, abortController.signal)

  logger.info('All services started')

  // Wait for all services (they run indefinitely until aborted)
  await Promise.all([...indexerPromises, executorPromise, webhookPromise])
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startRelayer().catch((error) => {
    logger.error({ error }, 'Failed to start relayer')
    process.exit(1)
  })
}
