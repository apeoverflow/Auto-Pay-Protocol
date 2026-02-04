import * as React from 'react'
import { parseAbiItem, type Log } from 'viem'
import { useWallet } from '../contexts/WalletContext'
import { useChain } from '../contexts/ChainContext'
import { ArcPolicyManagerAbi } from '../config/deployments'
import type { OnChainPolicy } from '../types/policy'

/**
 * @deprecated USES INDEXED DATA - NEEDS REFACTOR
 *
 * This hook fetches policies by scanning PolicyCreated event logs.
 *
 * CURRENT LIMITATIONS:
 * - Only sees last ~9,000 blocks due to RPC getLogs limits
 * - Policies created before this window are invisible
 * - Rate-limited on Arc RPC (300ms delays between requests)
 *
 * REFACTOR TO:
 * - Call indexer API: GET /api/policies?payer={address}
 * - Indexer stores full history from all PolicyCreated events
 *
 * ALTERNATIVE (if no indexer):
 * - Add on-chain mapping: mapping(address => bytes32[]) payerPolicies
 * - Add getter: getPayerPolicies(address) returns (bytes32[])
 * - Trade-off: ~20k extra gas per createPolicy
 */

interface UsePoliciesReturn {
  policies: OnChainPolicy[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// PolicyCreated event signature
const PolicyCreatedEvent = parseAbiItem(
  'event PolicyCreated(bytes32 indexed policyId, address indexed payer, address indexed merchant, uint128 chargeAmount, uint32 interval, uint128 spendingCap, string metadataUrl)'
)

// Maximum block range per request (Arc RPC limits to 10,000)
const MAX_RANGE = 9000n

export function usePolicies(): UsePoliciesReturn {
  const { account } = useWallet()
  const { publicClient, chainConfig } = useChain()

  const [policies, setPolicies] = React.useState<OnChainPolicy[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchPolicies = React.useCallback(async () => {
    if (!publicClient || !account?.address || !chainConfig.policyManager) {
      setPolicies([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const currentBlock = await publicClient.getBlockNumber()

      // Use a single request with 9k block lookback to avoid rate limiting
      // For full history, would need pagination with delays
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
          endTime,
          active,
          metadataUrl,
        } as OnChainPolicy
      })

      const fetchedPolicies = await Promise.all(policyPromises)

      // Sort by most recent first (using lastCharged as proxy)
      fetchedPolicies.sort((a, b) => b.lastCharged - a.lastCharged)

      setPolicies(fetchedPolicies)
    } catch (err) {
      console.error('Failed to fetch policies:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch policies')
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, account?.address, chainConfig.policyManager])

  // Fetch policies on mount and when dependencies change
  React.useEffect(() => {
    fetchPolicies()
  }, [fetchPolicies])

  return {
    policies,
    isLoading,
    error,
    refetch: fetchPolicies,
  }
}
