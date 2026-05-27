import * as React from 'react'
import { useChain } from '../contexts/ChainContext'
import { PolicyManagerAbi } from '../config/deployments'
import type { OnChainPolicy } from '../types/policy'

interface UsePolicyReturn {
  policy: OnChainPolicy | null
  canCharge: boolean
  canChargeReason: string
  nextChargeTime: number
  remainingAllowance: bigint
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function usePolicy(policyId: `0x${string}` | undefined): UsePolicyReturn {
  const { publicClient, chainConfig } = useChain()

  const [policy, setPolicy] = React.useState<OnChainPolicy | null>(null)
  const [canCharge, setCanCharge] = React.useState(false)
  const [canChargeReason, setCanChargeReason] = React.useState('')
  const [nextChargeTime, setNextChargeTime] = React.useState(0)
  const [remainingAllowance, setRemainingAllowance] = React.useState(0n)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchPolicy = React.useCallback(async () => {
    if (!publicClient || !policyId || !chainConfig.policyManager) {
      setPolicy(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [policyData, canChargeResult, nextChargeResult, remainingResult] =
        await Promise.all([
          publicClient.readContract({
            address: chainConfig.policyManager,
            abi: PolicyManagerAbi,
            functionName: 'policies',
            args: [policyId],
          }),
          publicClient.readContract({
            address: chainConfig.policyManager,
            abi: PolicyManagerAbi,
            functionName: 'canCharge',
            args: [policyId],
          }),
          publicClient.readContract({
            address: chainConfig.policyManager,
            abi: PolicyManagerAbi,
            functionName: 'getNextChargeTime',
            args: [policyId],
          }),
          publicClient.readContract({
            address: chainConfig.policyManager,
            abi: PolicyManagerAbi,
            functionName: 'getRemainingAllowance',
            args: [policyId],
          }),
        ])

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

      setPolicy({
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
      })

      const [canChargeValue, reason] = canChargeResult as [boolean, string]
      setCanCharge(canChargeValue)
      setCanChargeReason(reason)

      setNextChargeTime(Number(nextChargeResult))

      setRemainingAllowance(remainingResult as bigint)
    } catch (err) {
      console.error('Failed to fetch policy:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch policy')
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, policyId, chainConfig.policyManager])

  React.useEffect(() => {
    fetchPolicy()
  }, [fetchPolicy])

  return {
    policy,
    canCharge,
    canChargeReason,
    nextChargeTime,
    remainingAllowance,
    isLoading,
    error,
    refetch: fetchPolicy,
  }
}
