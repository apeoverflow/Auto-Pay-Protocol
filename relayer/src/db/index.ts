import postgres from 'postgres'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db')

let sql: ReturnType<typeof postgres> | null = null

export function getDb(databaseUrl: string) {
  if (!sql) {
    sql = postgres(databaseUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    })
    logger.info('Database connection pool created')
  }
  return sql
}

export async function closeDb() {
  if (sql) {
    await sql.end()
    sql = null
    logger.info('Database connection closed')
  }
}

// Get overall relayer status
export async function getStatus(databaseUrl: string) {
  const db = getDb(databaseUrl)

  const indexerStates = await db`
    SELECT chain_id, last_indexed_block, updated_at
    FROM indexer_state
  `

  const policyStats = await db`
    SELECT
      chain_id,
      COUNT(*) FILTER (WHERE active = true) as active_policies,
      COUNT(*) FILTER (WHERE active = true AND next_charge_at <= NOW()) as pending_charges
    FROM policies
    GROUP BY chain_id
  `

  const webhookStats = await db`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'failed') as failed
    FROM webhooks
  `

  const chains: Record<
    number,
    {
      lastIndexedBlock: number
      activePolicies: number
      pendingCharges: number
    }
  > = {}

  for (const state of indexerStates) {
    chains[state.chain_id] = {
      lastIndexedBlock: state.last_indexed_block,
      activePolicies: 0,
      pendingCharges: 0,
    }
  }

  for (const stat of policyStats) {
    if (chains[stat.chain_id]) {
      chains[stat.chain_id].activePolicies = Number(stat.active_policies)
      chains[stat.chain_id].pendingCharges = Number(stat.pending_charges)
    }
  }

  return {
    chains,
    webhooks: {
      pending: Number(webhookStats[0]?.pending ?? 0),
      failed: Number(webhookStats[0]?.failed ?? 0),
    },
  }
}
