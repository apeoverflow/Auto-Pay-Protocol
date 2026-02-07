import * as React from 'react'
import { parseAbiItem, decodeEventLog, type Log, type TransactionReceipt } from 'viem'
import { useWallet } from '../contexts/WalletContext'
import { useChain } from '../contexts/ChainContext'
import { ArcPolicyManagerAbi } from '../config/deployments'
import { fetchActivityFromDb, type DbPolicy, type DbCharge } from '../lib/supabase'
import { sleep } from '../lib/rateLimit'
import type { ActivityItem } from '../types/subscriptions'

/**
 * Fetches activity feed for the connected wallet.
 *
 * DATA SOURCE PRIORITY:
 * 1. Supabase (indexed data) - Full history, fast queries, pre-computed timestamps
 * 2. Contract events (fallback) - Limited to ~9k blocks, multiple RPC calls
 *
 * REAL-TIME UPDATES:
 * After write operations, call addActivityFromReceipt() with the transaction
 * receipt to parse real events and add them to the activity feed.
 */

interface UseActivityReturn {
  activity: ActivityItem[]
  isLoading: boolean
  error: string | null
  dataSource: 'supabase' | 'contract' | null
  refetch: () => Promise<void>
  // Real-time update - parse events from transaction receipt
  addActivityFromReceipt: (receipt: TransactionReceipt) => void
}

// Event signatures from ArcPolicyManager (for contract fallback)
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

// Convert Supabase data to ActivityItems
function dbToActivityItems(
  policies: DbPolicy[],
  charges: DbCharge[]
): ActivityItem[] {
  const items: ActivityItem[] = []

  // Add charge events
  for (const charge of charges) {
    const policy = policies.find(p => p.id === charge.policy_id)
    items.push({
      id: `charge-${charge.tx_hash || charge.id}`,
      type: 'charge',
      timestamp: new Date(charge.completed_at || charge.created_at),
      amount: BigInt(charge.amount),
      token: 'USDC',
      merchant: policy ? formatAddress(policy.merchant) : 'Unknown',
      metadataUrl: policy?.metadata_url || undefined,
      txHash: (charge.tx_hash || '0x') as `0x${string}`,
      status: charge.status === 'success' ? 'confirmed' : 'failed',
    })
  }

  // Add subscribe events (from policy creation)
  for (const policy of policies) {
    items.push({
      id: `subscribe-${policy.created_tx}`,
      type: 'subscribe',
      timestamp: new Date(policy.created_at),
      amount: BigInt(policy.charge_amount),
      token: 'USDC',
      merchant: formatAddress(policy.merchant),
      metadataUrl: policy.metadata_url || undefined,
      txHash: policy.created_tx as `0x${string}`,
      status: 'confirmed',
    })

    // Add cancel events if policy was revoked
    if (!policy.active && policy.ended_at) {
      items.push({
        id: `cancel-${policy.id}`,
        type: 'cancel',
        timestamp: new Date(policy.ended_at),
        merchant: formatAddress(policy.merchant),
        metadataUrl: policy.metadata_url || undefined,
        txHash: policy.created_tx as `0x${string}`, // Use created_tx as fallback
        status: 'confirmed',
      })
    }
  }

  // Sort by timestamp descending
  items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return items
}

// ── Module-level invalidation so all useActivity() instances can be triggered ──
type ActivityRefetchFn = () => void
const activityListeners = new Set<ActivityRefetchFn>()

/** Call from anywhere to trigger all useActivity() instances to refetch */
export function invalidateActivity() {
  for (const fn of activityListeners) fn()
}

export function useActivity(): UseActivityReturn {
  const { account } = useWallet()
  const { publicClient, chainConfig } = useChain()

  const [activity, setActivity] = React.useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [dataSource, setDataSource] = React.useState<'supabase' | 'contract' | null>(null)

  const fetchActivity = React.useCallback(async () => {
    if (!account?.address || !chainConfig.policyManager) {
      setActivity([])
      setDataSource(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Try Supabase first (full indexed history)
      const dbData = await fetchActivityFromDb(
        account.address,
        chainConfig.chain.id
      )

      if (dbData !== null) {
        // Successfully fetched from Supabase
        const items = dbToActivityItems(dbData.policies, dbData.charges)
        setActivity(items)
        setDataSource('supabase')
        return
      }

      // Fallback to contract events (limited history)
      if (!publicClient) {
        setActivity([])
        setDataSource(null)
        return
      }

      console.log('Supabase unavailable, falling back to contract events')

      const currentBlock = await publicClient.getBlockNumber()
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

      // Build merchant→metadataUrl lookup from create logs
      const merchantMetadata = new Map<string, string>()
      for (const log of createLogs) {
        if (log.args.metadataUrl) {
          merchantMetadata.set(log.args.merchant.toLowerCase(), log.args.metadataUrl)
        }
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
          metadataUrl: merchantMetadata.get(log.args.merchant.toLowerCase()),
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
          metadataUrl: log.args.metadataUrl || undefined,
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
          metadataUrl: merchantMetadata.get(log.args.merchant.toLowerCase()),
          txHash: log.transactionHash,
          status: 'confirmed',
        })
      }

      // Sort by timestamp descending (most recent first)
      items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

      setActivity(items)
      setDataSource('contract')
    } catch (err) {
      console.error('Failed to fetch activity:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch activity')
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, account?.address, chainConfig.policyManager, chainConfig.chain.id])

  // Parse events from a transaction receipt and add to activity
  const addActivityFromReceipt = React.useCallback(
    (receipt: TransactionReceipt) => {
      const newItems: ActivityItem[] = []

      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: ArcPolicyManagerAbi,
            data: log.data,
            topics: log.topics,
          })

          if (decoded.eventName === 'PolicyCreated') {
            const args = decoded.args as unknown as { merchant: string; chargeAmount: bigint }
            newItems.push({
              id: `subscribe-${receipt.transactionHash}-${log.logIndex}`,
              type: 'subscribe',
              timestamp: new Date(),
              amount: args.chargeAmount,
              token: 'USDC',
              merchant: formatAddress(args.merchant),
              txHash: receipt.transactionHash,
              status: 'confirmed',
            })
          } else if (decoded.eventName === 'ChargeSucceeded') {
            const args = decoded.args as unknown as { merchant: string; amount: bigint }
            newItems.push({
              id: `charge-${receipt.transactionHash}-${log.logIndex}`,
              type: 'charge',
              timestamp: new Date(),
              amount: args.amount,
              token: 'USDC',
              merchant: formatAddress(args.merchant),
              txHash: receipt.transactionHash,
              status: 'confirmed',
            })
          } else if (decoded.eventName === 'PolicyRevoked') {
            const args = decoded.args as unknown as { merchant: string }
            newItems.push({
              id: `cancel-${receipt.transactionHash}-${log.logIndex}`,
              type: 'cancel',
              timestamp: new Date(),
              merchant: formatAddress(args.merchant),
              txHash: receipt.transactionHash,
              status: 'confirmed',
            })
          }
        } catch {
          // Not an event we're interested in, skip
        }
      }

      if (newItems.length > 0) {
        setActivity((prev) => {
          // Filter out duplicates by id
          const existingIds = new Set(prev.map((item) => item.id))
          const uniqueNewItems = newItems.filter((item) => !existingIds.has(item.id))
          return [...uniqueNewItems, ...prev]
        })
      }
    },
    []
  )

  // Fetch activity on mount and when dependencies change
  React.useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  // Subscribe to cross-instance invalidation
  React.useEffect(() => {
    const handler = () => { fetchActivity() }
    activityListeners.add(handler)
    return () => { activityListeners.delete(handler) }
  }, [fetchActivity])

  return {
    activity,
    isLoading,
    error,
    dataSource,
    refetch: fetchActivity,
    addActivityFromReceipt,
  }
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
