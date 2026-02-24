#!/usr/bin/env tsx
import { Command } from 'commander'
import { loadConfig, getEnabledChains, RETRY_PRESETS } from '../src/config.js'
import { createLogger } from '../src/utils/logger.js'
import { formatRetryConfig } from '../src/executor/retry.js'

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
  .option('--chain <chain>', 'Chain to index', 'flowEvm')
  .option('--from-block <block>', 'Start from specific block')
  .action(async (options) => {
    const config = loadConfig()
    const chainConfig = config.chains[options.chain]
    if (!chainConfig) {
      logger.error(`Unknown chain: ${options.chain}`)
      process.exit(1)
    }

    let startBlock: number | undefined
    if (options.fromBlock) {
      startBlock = parseInt(options.fromBlock, 10)
      if (isNaN(startBlock) || startBlock < 0) {
        logger.error('Invalid --from-block: must be a non-negative integer')
        process.exit(1)
      }
    }

    logger.info({ chain: options.chain, startBlock }, 'Running indexer once...')

    const { runIndexerOnce } = await import('../src/indexer/index.js')
    await runIndexerOnce(chainConfig, config.databaseUrl, config.merchantAddresses, startBlock)
    logger.info('Indexer run complete')
  })

program
  .command('charge')
  .description('Manually charge a policy')
  .argument('<policyId>', 'Policy ID to charge (bytes32 hex string)')
  .action(async (policyId: string) => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(policyId)) {
      logger.error('Invalid policyId: must be a 0x-prefixed 32-byte hex string (66 characters)')
      process.exit(1)
    }
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
  .option('--chain <chain>', 'Chain to backfill', 'flowEvm')
  .requiredOption('--from-block <block>', 'Block to start from')
  .action(async (options) => {
    const config = loadConfig()
    const chainConfig = config.chains[options.chain]
    if (!chainConfig) {
      logger.error(`Unknown chain: ${options.chain}`)
      process.exit(1)
    }

    const fromBlock = parseInt(options.fromBlock, 10)
    if (isNaN(fromBlock) || fromBlock < 0) {
      logger.error('Invalid --from-block: must be a non-negative integer')
      process.exit(1)
    }
    logger.info({ chain: options.chain, fromBlock }, 'Backfilling events...')

    const { backfillEvents } = await import('../src/indexer/index.js')
    await backfillEvents(chainConfig, config.databaseUrl, config.merchantAddresses, fromBlock)
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

// ==================== Config Commands ====================

program
  .command('config:retry')
  .description('Show current retry configuration')
  .action(async () => {
    const config = loadConfig()

    console.log('\n=== Retry Configuration ===\n')
    console.log(`Current: ${formatRetryConfig(config.retry)}`)
    console.log()
    console.log('Available presets:')
    for (const [name, preset] of Object.entries(RETRY_PRESETS)) {
      const formatMs = (ms: number) => {
        if (ms >= 3600000) return `${ms / 3600000}hr`
        if (ms >= 60000) return `${ms / 60000}min`
        return `${ms / 1000}s`
      }
      const backoffs = preset.backoffMs.map(formatMs).join(' → ')
      console.log(`  ${name}: ${preset.maxRetries} retries (${backoffs}), cancel after ${preset.maxConsecutiveFailures} failures`)
    }
    console.log()
    console.log('To change, set environment variables:')
    console.log('  RETRY_PRESET=aggressive|standard|conservative|custom')
    console.log()
    console.log('For custom preset:')
    console.log('  RETRY_PRESET=custom')
    console.log('  RETRY_MAX_RETRIES=3')
    console.log('  RETRY_BACKOFF_MS=60000,300000,900000')
    console.log('  RETRY_MAX_CONSECUTIVE_FAILURES=3')
    console.log()
  })

// ==================== Metadata Commands ====================

program
  .command('metadata:add')
  .description('Add or update plan metadata from a JSON file')
  .requiredOption('--id <id>', 'Metadata ID (used in URL: /metadata/<id>)')
  .requiredOption('--merchant <address>', 'Merchant address')
  .requiredOption('--file <path>', 'Path to JSON metadata file')
  .option('--status <status>', 'Plan status (draft, active, archived)', 'active')
  .action(async (options) => {
    const { readFileSync } = await import('fs')
    const config = loadConfig()
    const { upsertPlanMetadata } = await import('../src/db/metadata.js')

    try {
      const content = readFileSync(options.file, 'utf-8')
      const metadata = JSON.parse(content)

      await upsertPlanMetadata(
        config.databaseUrl,
        options.id,
        options.merchant,
        metadata,
        options.status
      )

      console.log(`\n✅ Metadata saved!`)
      console.log(`   ID: ${options.id}`)
      console.log(`   Merchant: ${options.merchant}`)
      console.log(`   URL: /metadata/${options.merchant.toLowerCase()}/${options.id}`)
      console.log()
    } catch (err) {
      logger.error({ error: err }, 'Failed to add metadata')
      process.exit(1)
    }
  })

program
  .command('metadata:list')
  .description('List all plan metadata')
  .action(async () => {
    const config = loadConfig()
    const { listAllPlanMetadata } = await import('../src/db/metadata.js')

    const metadata = await listAllPlanMetadata(config.databaseUrl)

    console.log('\n=== Plan Metadata ===\n')

    if (metadata.length === 0) {
      console.log('No metadata registered yet.')
      console.log('\nUse: relayer metadata:add --id <id> --merchant <address> --file <path>')
    } else {
      for (const m of metadata) {
        console.log(`ID: ${m.id}`)
        console.log(`  Merchant: ${m.merchant_address}`)
        console.log(`  Plan: ${m.metadata.plan?.name ?? 'N/A'}`)
        console.log(`  Status: ${m.status}`)
        console.log(`  URL: /metadata/${m.merchant_address}/${m.id}`)
        console.log(`  Created: ${m.created_at}`)
        console.log()
      }
    }
  })

program
  .command('metadata:get')
  .description('Get plan metadata by ID')
  .argument('<id>', 'Metadata ID')
  .option('--merchant <address>', 'Merchant address (scoped lookup)')
  .action(async (id: string, options: { merchant?: string }) => {
    const config = loadConfig()
    const { getPlanMetadata } = await import('../src/db/metadata.js')

    const metadata = await getPlanMetadata(config.databaseUrl, id, options.merchant)

    if (!metadata) {
      console.log(`\n❌ Metadata not found: ${id}${options.merchant ? ` (merchant: ${options.merchant})` : ''}\n`)
      process.exit(1)
    }

    console.log('\n=== Plan Metadata ===\n')
    console.log(`ID: ${metadata.id}`)
    console.log(`Merchant: ${metadata.merchant_address}`)
    console.log(`Status: ${metadata.status}`)
    console.log(`URL: /metadata/${metadata.merchant_address}/${metadata.id}`)
    console.log()
    console.log(JSON.stringify(metadata.metadata, null, 2))
    console.log()
  })

program
  .command('metadata:upload-ipfs')
  .description('Upload active plan metadata to IPFS via Storacha (backfill missing CIDs)')
  .option('--id <id>', 'Upload a specific plan only')
  .action(async (options) => {
    const config = loadConfig()
    const { listPlansWithoutIpfsCid } = await import('../src/db/metadata.js')
    const { uploadPlanToIPFS } = await import('../src/lib/ipfs-upload.js')
    const { isStorachaEnabled } = await import('../src/lib/storacha.js')

    if (!isStorachaEnabled()) {
      console.log('\n❌ Storacha not configured. Set STORACHA_PRINCIPAL_KEY and STORACHA_DELEGATION_PROOF.\n')
      process.exit(1)
    }

    const plans = await listPlansWithoutIpfsCid(config.databaseUrl, options.id)

    if (plans.length === 0) {
      console.log('\n✅ No active plans missing IPFS CIDs.\n')
      return
    }

    console.log(`\nUploading ${plans.length} plan(s) to IPFS...\n`)

    let success = 0
    let failed = 0

    for (const plan of plans) {
      try {
        await uploadPlanToIPFS(config.databaseUrl, plan.id, plan.merchant_address, plan.metadata)
        console.log(`  ✅ ${plan.id}`)
        success++
      } catch (err) {
        console.log(`  ❌ ${plan.id}: ${err instanceof Error ? err.message : String(err)}`)
        failed++
      }
    }

    console.log(`\nDone: ${success} uploaded, ${failed} failed.\n`)
  })

program
  .command('metadata:delete')
  .description('Delete plan metadata')
  .argument('<id>', 'Metadata ID to delete')
  .option('--merchant <address>', 'Merchant address (scoped delete)')
  .action(async (id: string, options: { merchant?: string }) => {
    const config = loadConfig()
    const { deletePlanMetadata } = await import('../src/db/metadata.js')

    const deleted = await deletePlanMetadata(config.databaseUrl, id, options.merchant)

    if (deleted) {
      console.log(`\n✅ Deleted metadata: ${id}\n`)
    } else {
      console.log(`\n❌ Metadata not found: ${id}${options.merchant ? ` (merchant: ${options.merchant})` : ''}\n`)
      process.exit(1)
    }
  })

// ==================== Report Commands ====================

program
  .command('reports:generate')
  .description('Generate encrypted monthly reports for merchants and upload to Filecoin via Storacha')
  .option('--chain <chain>', 'Chain to generate reports for', 'flowEvm')
  .option('--period <YYYY-MM>', 'Report period (default: previous month)')
  .option('--merchant <address>', 'Generate for a specific merchant only')
  .action(async (options) => {
    const config = loadConfig()
    const chainConfig = config.chains[options.chain]
    if (!chainConfig) {
      logger.error(`Unknown chain: ${options.chain}`)
      process.exit(1)
    }

    const { isStorachaEnabled, getStorachaClient } = await import('../src/lib/storacha.js')
    if (!isStorachaEnabled()) {
      console.log('\n❌ Storacha not configured. Set STORACHA_PRINCIPAL_KEY and STORACHA_DELEGATION_PROOF.\n')
      process.exit(1)
    }

    const { generateMonthlyReport } = await import('../src/reports/generate.js')
    const { encryptReport } = await import('../src/reports/encrypt.js')
    const { getMerchantEncryptionKey, listMerchantsWithEncryptionKeys } = await import('../src/db/merchants.js')
    const { saveReport } = await import('../src/db/reports.js')

    // Determine period (default: previous month)
    let period = options.period as string | undefined
    if (!period) {
      const now = new Date()
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      period = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`
    }

    // Validate period format
    if (!/^\d{4}-\d{2}$/.test(period)) {
      logger.error('Invalid period format. Use YYYY-MM (e.g. 2026-02)')
      process.exit(1)
    }

    // Get merchants to process
    let merchants: Array<{ address: string; encryption_key: string | null }>
    if (options.merchant) {
      const key = await getMerchantEncryptionKey(config.databaseUrl, options.merchant)
      if (!key) {
        console.log(`\n❌ Merchant ${options.merchant} has no encryption key registered. Skipping.\n`)
        process.exit(1)
      }
      merchants = [{ address: options.merchant.toLowerCase(), encryption_key: key }]
    } else {
      merchants = await listMerchantsWithEncryptionKeys(config.databaseUrl)
    }

    if (merchants.length === 0) {
      console.log('\n✅ No merchants with encryption keys found. Nothing to generate.\n')
      return
    }

    console.log(`\nGenerating ${period} reports for ${merchants.length} merchant(s) on ${chainConfig.name}...\n`)

    let success = 0
    let failed = 0

    for (const merchant of merchants) {
      try {
        if (!merchant.encryption_key) {
          console.log(`  ⏭ ${merchant.address}: no encryption key, skipping`)
          continue
        }

        // Generate report
        const report = await generateMonthlyReport(
          config.databaseUrl,
          chainConfig.chainId,
          merchant.address,
          period
        )

        // Encrypt with merchant's key
        const aesKey = Buffer.from(merchant.encryption_key.replace('0x', ''), 'hex')
        const encrypted = encryptReport(JSON.stringify(report), aesKey)

        // Upload encrypted blob to Storacha
        const client = (await getStorachaClient()) as {
          uploadFile: (file: Blob) => Promise<{ toString(): string }>
        }
        const blob = new Blob([encrypted], { type: 'application/octet-stream' })
        const cid = await client.uploadFile(blob)

        // Save CID to database
        await saveReport(config.databaseUrl, merchant.address, chainConfig.chainId, period, cid.toString())

        console.log(`  ✅ ${merchant.address}: ${cid.toString()}`)
        success++
      } catch (err) {
        console.log(`  ❌ ${merchant.address}: ${err instanceof Error ? err.message : String(err)}`)
        failed++
      }
    }

    console.log(`\nDone: ${success} generated, ${failed} failed.\n`)
  })

// ==================== Merchant Commands ====================

program
  .command('merchant:add')
  .description('Register a merchant webhook')
  .requiredOption('--address <address>', 'Merchant address')
  .requiredOption('--webhook-url <url>', 'Webhook URL')
  .requiredOption('--webhook-secret <secret>', 'Webhook secret for signing')
  .action(async (options) => {
    const config = loadConfig()
    const { upsertMerchant } = await import('../src/db/merchants.js')

    await upsertMerchant(
      config.databaseUrl,
      options.address,
      options.webhookUrl,
      options.webhookSecret
    )

    console.log(`\n✅ Merchant registered!`)
    console.log(`   Address: ${options.address}`)
    console.log(`   Webhook URL: ${options.webhookUrl}`)
    console.log()
  })

program
  .command('merchant:list')
  .description('List all registered merchants')
  .action(async () => {
    const config = loadConfig()
    const { listMerchants } = await import('../src/db/merchants.js')

    const merchants = await listMerchants(config.databaseUrl)

    console.log('\n=== Registered Merchants ===\n')

    if (merchants.length === 0) {
      console.log('No merchants registered yet.')
      console.log('\nUse: npm run cli -- merchant:add --address <addr> --webhook-url <url> --webhook-secret <secret>')
    } else {
      for (const m of merchants) {
        console.log(`Address: ${m.address}`)
        console.log(`  Webhook URL: ${m.webhook_url ?? '(not set)'}`)
        console.log(`  Webhook Secret: ${m.webhook_secret ? '(configured)' : '(not set)'}`)
        console.log(`  Registered: ${m.created_at}`)
        console.log()
      }
    }
  })

program.parse()
