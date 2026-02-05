import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:indexer-state')

export async function getLastIndexedBlock(
  databaseUrl: string,
  chainId: number
): Promise<number | null> {
  const db = getDb(databaseUrl)

  const rows = await db`
    SELECT last_indexed_block
    FROM indexer_state
    WHERE chain_id = ${chainId}
  `

  if (rows.length === 0) {
    return null
  }

  return Number(rows[0].last_indexed_block)
}

export async function setLastIndexedBlock(
  databaseUrl: string,
  chainId: number,
  blockNumber: number
) {
  const db = getDb(databaseUrl)

  await db`
    INSERT INTO indexer_state (chain_id, last_indexed_block, updated_at)
    VALUES (${chainId}, ${blockNumber}, NOW())
    ON CONFLICT (chain_id) DO UPDATE
    SET last_indexed_block = ${blockNumber}, updated_at = NOW()
  `

  logger.debug({ chainId, blockNumber }, 'Updated last indexed block')
}

export async function initializeIndexerState(
  databaseUrl: string,
  chainId: number,
  startBlock: number
) {
  const db = getDb(databaseUrl)

  // Only insert if not exists
  await db`
    INSERT INTO indexer_state (chain_id, last_indexed_block, updated_at)
    VALUES (${chainId}, ${startBlock - 1}, NOW())
    ON CONFLICT (chain_id) DO NOTHING
  `

  logger.debug(
    { chainId, startBlock },
    'Initialized indexer state'
  )
}
