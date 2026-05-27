import { loadConfig, getEnabledChains } from './config.js'
import { runMigrations } from './db/migrations/index.js'
import { closeDb } from './db/index.js'
import { startIndexerLoop } from './indexer/index.js'
import { startExecutorLoop } from './executor/index.js'
import { startWebhookSenderLoop } from './webhooks/index.js'
import { startPointsWorkerLoop } from './points/worker.js'
import { createApiServer, startApiServer, stopApiServer } from './api/index.js'
import { isStorachaEnabled } from './lib/storacha.js'
import { createLogger } from './utils/logger.js'
import { privateKeyToAccount } from 'viem/accounts'
import { setMaxListeners } from 'node:events'

const logger = createLogger('relayer')

export async function startRelayer() {
  logger.info('Starting AutoPay relayer...')

  const config = loadConfig()

  // Log the relayer wallet address
  const account = privateKeyToAccount(config.privateKey)
  logger.info({ wallet: account.address }, 'Relayer wallet')

  // Warn if auth is disabled
  if (process.env.AUTH_ENABLED !== 'true') {
    logger.warn('⚠️  AUTH_ENABLED is not set to "true" — all plan and receipt write endpoints are OPEN without authentication. Set AUTH_ENABLED=true in production.')
  }

  // Warn if Storacha (IPFS) is not configured — receipt uploads will be skipped
  if (!isStorachaEnabled()) {
    logger.warn('STORACHA_PRINCIPAL_KEY and/or STORACHA_DELEGATION_PROOF not set — charge receipt IPFS uploads are DISABLED. Receipts will not be archived to IPFS/Filecoin.')
  }

  // Log merchant filter status
  if (config.merchantAddresses) {
    logger.info(
      { merchants: Array.from(config.merchantAddresses), count: config.merchantAddresses.size },
      'Merchant filter ACTIVE - only processing listed merchants'
    )
  } else {
    logger.info('Merchant filter INACTIVE - processing all merchants')
  }

  // Run migrations
  logger.info('Running database migrations...')
  await runMigrations(config.databaseUrl)

  // Start API server (includes health, metadata, logos)
  const apiServer = await createApiServer(config)
  await startApiServer(apiServer, config.port)

  // Start services for each enabled chain
  const enabledChains = getEnabledChains(config)

  // Create abort controller for graceful shutdown
  const abortController = new AbortController()
  // Each service loop adds a listener; raise the limit to avoid the Node warning
  setMaxListeners(enabledChains.length + 10, abortController.signal)

  // Track if shutdown is in progress
  let shuttingDown = false
  logger.info(
    { chains: enabledChains.map((c) => c.name) },
    'Starting services for enabled chains'
  )

  // Start indexer loops (one per chain)
  const indexerPromises = enabledChains.map((chainConfig) =>
    startIndexerLoop(
      chainConfig,
      config.databaseUrl,
      config.merchantAddresses,
      chainConfig.pollIntervalMs,
      abortController.signal
    )
  )

  // Start executor loop (handles all chains)
  const executorPromise = startExecutorLoop(config, abortController.signal)

  // Start webhook sender loop
  const webhookPromise = startWebhookSenderLoop(config, abortController.signal)

  // Start points worker loop
  const pointsPromise = startPointsWorkerLoop(config, abortController.signal)

  const allServices = Promise.all([...indexerPromises, executorPromise, webhookPromise, pointsPromise])

  // Handle shutdown signals
  const shutdown = async () => {
    if (shuttingDown) {
      logger.info('Forced shutdown')
      process.exit(1)
    }
    shuttingDown = true

    logger.info('Shutting down (Ctrl+C again to force)...')

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
