#!/usr/bin/env tsx
import { Command } from 'commander'
import { loadConfig, getEnabledChains } from '../src/config.js'
import { createLogger } from '../src/utils/logger.js'

const logger = createLogger('cli')
const program = new Command()

program
  .name('relayer')
  .description('AutoPay Protocol relayer service')
  .version('0.1.0')

program
  .command('start')
  .description('Start the relayer service (indexer + executor + webhooks)')
  .action(async () => {
    logger.info('Starting relayer...')
    const { startRelayer } = await import('../src/index.js')
    await startRelayer()
  })

program
  .command('db:migrate')
  .description('Run database migrations')
  .action(async () => {
    logger.info('Running migrations...')
    const { runMigrations } = await import('../src/db/migrations/index.js')
    const config = loadConfig()
    await runMigrations(config.databaseUrl)
    logger.info('Migrations complete')
  })

program
  .command('index')
  .description('Run the indexer once for a chain')
  .option('--chain <chain>', 'Chain to index (arcTestnet)', 'arcTestnet')
  .option('--from-block <block>', 'Start from specific block')
  .action(async (options) => {
    const config = loadConfig()
    const chainConfig = config.chains[options.chain]
    if (!chainConfig) {
      logger.error(`Unknown chain: ${options.chain}`)
      process.exit(1)
    }

    const startBlock = options.fromBlock
      ? parseInt(options.fromBlock, 10)
      : undefined

    logger.info({ chain: options.chain, startBlock }, 'Running indexer once...')

    const { runIndexerOnce } = await import('../src/indexer/index.js')
    await runIndexerOnce(chainConfig, config.databaseUrl, startBlock)
    logger.info('Indexer run complete')
  })

program
  .command('charge')
  .description('Manually charge a policy')
  .argument('<policyId>', 'Policy ID to charge')
  .action(async (policyId: string) => {
    logger.info({ policyId }, 'Manually charging policy...')
    const config = loadConfig()
    const { chargePolicy } = await import('../src/executor/charge.js')
    const result = await chargePolicy(policyId, config)
    if (result.success) {
      logger.info({ txHash: result.txHash }, 'Charge successful')
    } else {
      logger.error({ error: result.error }, 'Charge failed')
    }
  })

program
  .command('backfill')
  .description('Backfill events from a specific block')
  .option('--chain <chain>', 'Chain to backfill', 'arcTestnet')
  .requiredOption('--from-block <block>', 'Block to start from')
  .action(async (options) => {
    const config = loadConfig()
    const chainConfig = config.chains[options.chain]
    if (!chainConfig) {
      logger.error(`Unknown chain: ${options.chain}`)
      process.exit(1)
    }

    const fromBlock = parseInt(options.fromBlock, 10)
    logger.info({ chain: options.chain, fromBlock }, 'Backfilling events...')

    const { backfillEvents } = await import('../src/indexer/index.js')
    await backfillEvents(chainConfig, config.databaseUrl, fromBlock)
    logger.info('Backfill complete')
  })

program
  .command('status')
  .description('Show relayer status')
  .action(async () => {
    const config = loadConfig()
    const { getStatus } = await import('../src/db/index.js')
    const status = await getStatus(config.databaseUrl)

    console.log('\n=== AutoPay Relayer Status ===\n')

    for (const chain of getEnabledChains(config)) {
      const chainStatus = status.chains[chain.chainId]
      console.log(`${chain.name} (${chain.chainId}):`)
      console.log(
        `  Last indexed block: ${chainStatus?.lastIndexedBlock ?? 'Not started'}`
      )
      console.log(`  Active policies: ${chainStatus?.activePolicies ?? 0}`)
      console.log(`  Pending charges: ${chainStatus?.pendingCharges ?? 0}`)
      console.log()
    }

    console.log('Webhooks:')
    console.log(`  Pending: ${status.webhooks.pending}`)
    console.log(`  Failed: ${status.webhooks.failed}`)
    console.log()
  })

program.parse()
