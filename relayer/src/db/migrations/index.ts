import postgres from 'postgres'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createLogger } from '../../utils/logger.js'

const logger = createLogger('migrations')

const __dirname = dirname(fileURLToPath(import.meta.url))

interface Migration {
  name: string
  sql: string
}

function loadMigrations(): Migration[] {
  const migrations: Migration[] = []

  // Load SQL migration files
  // 009 was removed (receipt_upload_status — never deployed to production, replaced by on-demand upload)
  const files = ['001_initial_schema.sql', '002_metadata.sql', '003_consecutive_failures.sql', '004_filecoin_storage.sql', '005_plan_status.sql', '006_plan_composite_key.sql', '007_report_json_cache.sql', '008_subscriber_data.sql', '010_merchant_api_keys.sql', '011_checkout_links.sql', '012_enable_rls.sql', '013_unique_charge_tx.sql', '014_fix_double_counted_charges.sql', '015_purge_dead_webhooks.sql', '016_terms_acceptances.sql', '017_points.sql', '018_points_backfill_reset.sql', '019_points_profile.sql', '020_payments.sql', '021_tempo_wallets.sql', '022_merchant_accounts.sql', '023_whitelist_addresses.sql', '024_fix_rls_policies.sql', '025_fix_missing_rls.sql', '026_email_verification_codes.sql']

  for (const file of files) {
    const sql = readFileSync(join(__dirname, file), 'utf-8')
    migrations.push({ name: file, sql })
  }

  return migrations
}

export async function runMigrations(databaseUrl: string) {
  const sql = postgres(databaseUrl)

  try {
    // Create migrations tracking table
    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    const migrations = loadMigrations()

    for (const migration of migrations) {
      // Check if migration already applied
      const applied = await sql`
        SELECT name FROM _migrations WHERE name = ${migration.name}
      `

      if (applied.length > 0) {
        logger.info({ name: migration.name }, 'Migration already applied')
        continue
      }

      logger.info({ name: migration.name }, 'Applying migration...')

      // Run migration + record in a single transaction so partial failures
      // don't leave the DB in an inconsistent state
      await sql.begin(async (tx) => {
        await tx.unsafe(migration.sql)
        await (tx as any)`
          INSERT INTO _migrations (name) VALUES (${migration.name})
        `
      })

      logger.info({ name: migration.name }, 'Migration applied')
    }

    logger.info('All migrations complete')
  } finally {
    await sql.end()
  }
}
