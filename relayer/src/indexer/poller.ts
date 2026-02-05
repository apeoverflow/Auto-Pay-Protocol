import { createPublicClient, http, type PublicClient, type Log } from 'viem'
import type { ChainConfig } from '../types.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('indexer:poller')

// Create a client for a chain
export function createChainClient(config: ChainConfig): PublicClient {
  return createPublicClient({
    transport: http(config.rpcUrl, {
      retryCount: 3,
      retryDelay: 1000,
    }),
  })
}

// Get latest block number
export async function getLatestBlock(client: PublicClient): Promise<bigint> {
  return client.getBlockNumber()
}

// Get block timestamp
export async function getBlockTimestamp(
  client: PublicClient,
  blockNumber: bigint
): Promise<Date> {
  const block = await client.getBlock({ blockNumber })
  return new Date(Number(block.timestamp) * 1000)
}

// Fetch logs for a block range
// Arc-specific: max 10k blocks per query, use 9k for safety
export async function fetchLogs(
  client: PublicClient,
  contractAddress: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint
): Promise<Log[]> {
  logger.debug(
    { fromBlock: Number(fromBlock), toBlock: Number(toBlock) },
    'Fetching logs'
  )

  const logs = await client.getLogs({
    address: contractAddress,
    fromBlock,
    toBlock,
  })

  logger.debug(
    { count: logs.length, fromBlock: Number(fromBlock), toBlock: Number(toBlock) },
    'Fetched logs'
  )

  return logs
}

// Poll for new events in batches
// Arc-specific: sequential requests with delays to avoid rate limiting
export async function* pollEvents(
  client: PublicClient,
  contractAddress: `0x${string}`,
  startBlock: bigint,
  batchSize: number,
  delayMs = 300
): AsyncGenerator<{ logs: Log[]; fromBlock: bigint; toBlock: bigint }> {
  let currentBlock = startBlock
  const latestBlock = await getLatestBlock(client)

  while (currentBlock <= latestBlock) {
    const toBlock =
      currentBlock + BigInt(batchSize) - 1n <= latestBlock
        ? currentBlock + BigInt(batchSize) - 1n
        : latestBlock

    const logs = await fetchLogs(client, contractAddress, currentBlock, toBlock)

    yield { logs, fromBlock: currentBlock, toBlock }

    currentBlock = toBlock + 1n

    // Rate limiting delay between requests
    if (currentBlock <= latestBlock && delayMs > 0) {
      await sleep(delayMs)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
