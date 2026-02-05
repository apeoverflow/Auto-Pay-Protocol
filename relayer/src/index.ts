import { loadConfig, getEnabledChains } from './config.js'
import { runMigrations } from './db/migrations/index.js'
import { closeDb } from './db/index.js'
import { startIndexerLoop } from './indexer/index.js'
import { startExecutorLoop } from './executor/index.js'
import { startWebhookSenderLoop } from './webhooks/index.js'
import { createApiServer, startApiServer, stopApiServer } from './api/index.js'
import { createLogger } from './utils/logger.js'

const logger = createLogger('relayer')

export async function startRelayer() {
  logger.info('Starting AutoPay relayer...')

  const config = loadConfig()

  // Run migrations
  logger.info('Running database migrations...')
  await runMigrations(config.databaseUrl)

  // Start API server (includes health, metadata, logos)
  const apiServer = await createApiServer(config)
  await startApiServer(apiServer, config.port)

  // Create abort controller for graceful shutdown
  const abortController = new AbortController()

  // Track if shutdown is in progress
  let shuttingDown = false

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

  const allServices = Promise.all([...indexerPromises, executorPromise, webhookPromise])

  // Handle shutdown signals
  const shutdown = async () => {
    if (shuttingDown) return // Prevent multiple shutdown calls
    shuttingDown = true

    logger.info('Shutting down...')

    // Signal all loops to stop
    abortController.abort()

    // Wait for loops to finish (with timeout)
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000))
    await Promise.race([allServices, timeout])

    // Clean up resources
    await stopApiServer(apiServer)
    await closeDb()

    logger.info('Shutdown complete')
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  logger.info('All services started')

  // Wait for all services (they run indefinitely until aborted)
  await allServices
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startRelayer().catch((error) => {
    logger.error({ error }, 'Failed to start relayer')
    process.exit(1)
  })
}
