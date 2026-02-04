import * as React from 'react'
import { parseAbiItem, type Log } from 'viem'
import { useWallet } from '../contexts/WalletContext'
import { useChain } from '../contexts/ChainContext'
import type { ActivityItem } from '../types/subscriptions'
import { sleep } from '../lib/rateLimit'

/**
 * @deprecated USES INDEXED DATA - NEEDS REFACTOR
 *
 * This hook fetches activity by scanning multiple event logs:
 * - ChargeSucceeded (payments)
 * - PolicyCreated (subscriptions)
 * - PolicyRevoked (cancellations)
 *
 * CURRENT LIMITATIONS:
 * - Only sees last ~9,000 blocks due to RPC getLogs limits
 * - Activity older than this window is invisible
 * - Makes 3 sequential getLogs calls + block timestamp fetches
 * - Rate-limited with 300ms delays to avoid Arc RPC throttling
 *
 * REFACTOR TO:
 * - Call indexer API: GET /api/activity?payer={address}
 * - Indexer stores full history with pre-computed timestamps
 * - Single API call replaces multiple RPC calls
 */

interface UseActivityReturn {
  activity: ActivityItem[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// Event signatures from ArcPolicyManager
const ChargeSucceededEvent = parseAbiItem(
  'event ChargeSucceeded(bytes32 indexed policyId, address indexed payer, address indexed merchant, uint128 amount, uint128 protocolFee)'
)

const PolicyCreatedEvent = parseAbiItem(
  'event PolicyCreated(bytes32 indexed policyId, address indexed payer, address indexed merchant, uint128 chargeAmount, uint32 interval, uint128 spendingCap, string metadataUrl)'
)

const PolicyRevokedEvent = parseAbiItem(
  'event PolicyRevoked(bytes32 indexed policyId, address indexed payer, address indexed merchant, uint32 endTime)'
)

// Log types for each event
type ChargeLog = Log<bigint, number, false, typeof ChargeSucceededEvent, true>
type CreateLog = Log<bigint, number, false, typeof PolicyCreatedEvent, true>
type RevokeLog = Log<bigint, number, false, typeof PolicyRevokedEvent, true>

// Maximum block range per request (Arc RPC limits to 10,000)
const MAX_RANGE = 9000n

// Delay between sequential requests to avoid rate limiting
const REQUEST_DELAY = 300

export function useActivity(): UseActivityReturn {
  const { account } = useWallet()
  const { publicClient, chainConfig } = useChain()

  const [activity, setActivity] = React.useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchActivity = React.useCallback(async () => {
    if (!publicClient || !account?.address || !chainConfig.policyManager) {
      setActivity([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const currentBlock = await publicClient.getBlockNumber()

      // Use a single block range to avoid pagination rate limits
      const fromBlock = currentBlock > MAX_RANGE ? currentBlock - MAX_RANGE : 0n

      // Fetch events sequentially with delays to avoid rate limiting
      const chargeLogs = await publicClient.getLogs({
        address: chainConfig.policyManager,
        event: ChargeSucceededEvent,
        args: { payer: account.address },
        fromBlock,
        toBlock: currentBlock,
      }) as unknown as ChargeLog[]

      await sleep(REQUEST_DELAY)

      const createLogs = await publicClient.getLogs({
        address: chainConfig.policyManager,
        event: PolicyCreatedEvent,
        args: { payer: account.address },
        fromBlock,
        toBlock: currentBlock,
      }) as unknown as CreateLog[]

      await sleep(REQUEST_DELAY)

      const revokeLogs = await publicClient.getLogs({
        address: chainConfig.policyManager,
        event: PolicyRevokedEvent,
        args: { payer: account.address },
        fromBlock,
        toBlock: currentBlock,
      }) as unknown as RevokeLog[]

      // Get block timestamps for all unique blocks
      const blockNumbers = new Set<bigint>()
      ;[...chargeLogs, ...createLogs, ...revokeLogs].forEach(log => {
        if (log.blockNumber) blockNumbers.add(log.blockNumber)
      })

      const blockTimestamps = new Map<bigint, number>()
      // Fetch block timestamps sequentially with delays
      for (const blockNumber of blockNumbers) {
        await sleep(REQUEST_DELAY)
        const block = await publicClient.getBlock({ blockNumber })
        blockTimestamps.set(blockNumber, Number(block.timestamp))
      }

      const items: ActivityItem[] = []

      // Process charge events
      for (const log of chargeLogs) {
        const timestamp = log.blockNumber ? blockTimestamps.get(log.blockNumber) : Date.now() / 1000
        items.push({
          id: `charge-${log.transactionHash}-${log.logIndex}`,
          type: 'charge',
          timestamp: new Date((timestamp || 0) * 1000),
          amount: log.args.amount,
          token: 'USDC',
          merchant: formatAddress(log.args.merchant),
          txHash: log.transactionHash,
          status: 'confirmed',
        })
      }

      // Process subscribe (create) events
      for (const log of createLogs) {
        const timestamp = log.blockNumber ? blockTimestamps.get(log.blockNumber) : Date.now() / 1000
        items.push({
          id: `subscribe-${log.transactionHash}-${log.logIndex}`,
          type: 'subscribe',
          timestamp: new Date((timestamp || 0) * 1000),
          amount: log.args.chargeAmount,
          token: 'USDC',
          merchant: formatAddress(log.args.merchant),
          txHash: log.transactionHash,
          status: 'confirmed',
        })
      }

      // Process cancel (revoke) events
      for (const log of revokeLogs) {
        const timestamp = log.blockNumber ? blockTimestamps.get(log.blockNumber) : Date.now() / 1000
        items.push({
          id: `cancel-${log.transactionHash}-${log.logIndex}`,
          type: 'cancel',
          timestamp: new Date((timestamp || 0) * 1000),
          merchant: formatAddress(log.args.merchant),
          txHash: log.transactionHash,
          status: 'confirmed',
        })
      }

      // Sort by timestamp descending (most recent first)
      items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

      setActivity(items)
    } catch (err) {
      console.error('Failed to fetch activity:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch activity')
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, account?.address, chainConfig.policyManager])

  // Fetch activity on mount and when dependencies change
  React.useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  return {
    activity,
    isLoading,
    error,
    refetch: fetchActivity,
  }
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
