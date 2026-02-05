import * as React from 'react'
import { parseAbiItem, type Log } from 'viem'
import { useWallet } from '../contexts/WalletContext'
import { useChain } from '../contexts/ChainContext'
import { ArcPolicyManagerAbi } from '../config/deployments'
import { fetchPoliciesFromDb, type DbPolicy } from '../lib/supabase'
import type { OnChainPolicy } from '../types/policy'

/**
 * Fetches policies for the connected wallet.
 *
 * DATA SOURCE PRIORITY:
 * 1. Supabase (indexed data) - Full history, fast queries
 * 2. Contract events (fallback) - Limited to ~9k blocks, slower
 *
 * The Supabase database is populated by the relayer indexer which
 * continuously indexes PolicyCreated/PolicyRevoked events.
 */

interface UsePoliciesReturn {
  policies: OnChainPolicy[]
  isLoading: boolean
  error: string | null
  dataSource: 'supabase' | 'contract' | null
  refetch: () => Promise<void>
}

// PolicyCreated event signature (for contract fallback)
const PolicyCreatedEvent = parseAbiItem(
  'event PolicyCreated(bytes32 indexed policyId, address indexed payer, address indexed merchant, uint128 chargeAmount, uint32 interval, uint128 spendingCap, string metadataUrl)'
)

// Maximum block range per request (Arc RPC limits to 10,000)
const MAX_RANGE = 9000n

// Convert Supabase DbPolicy to OnChainPolicy
function dbPolicyToOnChainPolicy(db: DbPolicy): OnChainPolicy {
  return {
    policyId: db.id as `0x${string}`,
    payer: db.payer as `0x${string}`,
    merchant: db.merchant as `0x${string}`,
    chargeAmount: BigInt(db.charge_amount),
    spendingCap: BigInt(db.spending_cap),
    totalSpent: BigInt(db.total_spent),
    interval: db.interval_seconds,
    lastCharged: db.last_charged_at
      ? Math.floor(new Date(db.last_charged_at).getTime() / 1000)
      : 0,
    chargeCount: db.charge_count,
    consecutiveFailures: 0, // Not tracked in DB, default to 0
    endTime: db.ended_at
      ? Math.floor(new Date(db.ended_at).getTime() / 1000)
      : 0,
    active: db.active,
    metadataUrl: db.metadata_url || '',
  }
}

export function usePolicies(): UsePoliciesReturn {
  const { account } = useWallet()
  const { publicClient, chainConfig } = useChain()

  const [policies, setPolicies] = React.useState<OnChainPolicy[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [dataSource, setDataSource] = React.useState<'supabase' | 'contract' | null>(null)

  const fetchPolicies = React.useCallback(async () => {
    if (!account?.address || !chainConfig.policyManager) {
      setPolicies([])
      setDataSource(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Try Supabase first (full indexed history)
      const dbPolicies = await fetchPoliciesFromDb(
        account.address,
        chainConfig.chain.id
      )

      if (dbPolicies !== null) {
        // Successfully fetched from Supabase
        const converted = dbPolicies.map(dbPolicyToOnChainPolicy)
        // Sort by most recent first
        converted.sort((a, b) => b.lastCharged - a.lastCharged)
        setPolicies(converted)
        setDataSource('supabase')
        return
      }

      // Fallback to contract events (limited history)
      if (!publicClient) {
        setPolicies([])
        setDataSource(null)
        return
      }

      console.log('Supabase unavailable, falling back to contract events')

      const currentBlock = await publicClient.getBlockNumber()
      const fromBlock = currentBlock > MAX_RANGE ? currentBlock - MAX_RANGE : 0n

      type PolicyCreatedLog = Log<bigint, number, false, typeof PolicyCreatedEvent, true>

      const logs = await publicClient.getLogs({
        address: chainConfig.policyManager,
        event: PolicyCreatedEvent,
        args: { payer: account.address },
        fromBlock,
        toBlock: currentBlock,
      }) as unknown as PolicyCreatedLog[]

      // Fetch current state for each policy
      const policyPromises = logs.map(async (log) => {
        const policyId = log.args.policyId as `0x${string}`

        const policyData = await publicClient.readContract({
          address: chainConfig.policyManager!,
          abi: ArcPolicyManagerAbi,
          functionName: 'policies',
          args: [policyId],
        })

        // Map tuple to OnChainPolicy
        const [
          payer,
          merchant,
          chargeAmount,
          spendingCap,
          totalSpent,
          interval,
          lastCharged,
          chargeCount,
          consecutiveFailures,
          endTime,
          active,
          metadataUrl,
        ] = policyData as [
          `0x${string}`,
          `0x${string}`,
          bigint,
          bigint,
          bigint,
          number,
          number,
          number,
          number,
          number,
          boolean,
          string
        ]

        return {
          policyId,
          payer,
          merchant,
          chargeAmount,
          spendingCap,
          totalSpent,
          interval,
          lastCharged,
          chargeCount,
          consecutiveFailures,
          endTime,
          active,
          metadataUrl,
        } as OnChainPolicy
      })

      const fetchedPolicies = await Promise.all(policyPromises)
      fetchedPolicies.sort((a, b) => b.lastCharged - a.lastCharged)

      setPolicies(fetchedPolicies)
      setDataSource('contract')
    } catch (err) {
      console.error('Failed to fetch policies:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch policies')
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, account?.address, chainConfig.policyManager, chainConfig.chain.id])

  // Fetch policies on mount and when dependencies change
  React.useEffect(() => {
    fetchPolicies()
  }, [fetchPolicies])

  return {
    policies,
    isLoading,
    error,
    dataSource,
    refetch: fetchPolicies,
  }
}
