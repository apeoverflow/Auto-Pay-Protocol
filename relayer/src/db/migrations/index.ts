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
  const files = ['001_initial_schema.sql', '002_metadata.sql', '003_consecutive_failures.sql', '004_filecoin_storage.sql', '005_plan_status.sql', '006_plan_composite_key.sql', '007_report_json_cache.sql', '008_subscriber_data.sql', '010_merchant_api_keys.sql', '011_checkout_links.sql', '012_enable_rls.sql']

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

      // Run migration
      await sql.unsafe(migration.sql)
      await sql`
        INSERT INTO _migrations (name) VALUES (${migration.name})
      `

      logger.info({ name: migration.name }, 'Migration applied')
    }

    logger.info('All migrations complete')
  } finally {
    await sql.end()
  }
}
