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
  const files = ['001_initial_schema.sql']

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
