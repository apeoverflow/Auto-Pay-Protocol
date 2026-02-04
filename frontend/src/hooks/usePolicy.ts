import * as React from 'react'
import { useChain } from '../contexts/ChainContext'
import { ArcPolicyManagerAbi } from '../config/deployments'
import type { OnChainPolicy, PolicyChargeBreakdown } from '../types/policy'

interface UsePolicyReturn {
  policy: OnChainPolicy | null
  canCharge: boolean
  canChargeReason: string
  nextChargeTime: number
  remainingAllowance: bigint
  chargeBreakdown: PolicyChargeBreakdown | null
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
  const [chargeBreakdown, setChargeBreakdown] = React.useState<PolicyChargeBreakdown | null>(null)
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
      // Fetch all policy data in parallel
      const [policyData, canChargeResult, nextChargeResult, remainingResult, breakdownResult] =
        await Promise.all([
          publicClient.readContract({
            address: chainConfig.policyManager,
            abi: ArcPolicyManagerAbi,
            functionName: 'policies',
            args: [policyId],
          }),
          publicClient.readContract({
            address: chainConfig.policyManager,
            abi: ArcPolicyManagerAbi,
            functionName: 'canCharge',
            args: [policyId],
          }),
          publicClient.readContract({
            address: chainConfig.policyManager,
            abi: ArcPolicyManagerAbi,
            functionName: 'getNextChargeTime',
            args: [policyId],
          }),
          publicClient.readContract({
            address: chainConfig.policyManager,
            abi: ArcPolicyManagerAbi,
            functionName: 'getRemainingAllowance',
            args: [policyId],
          }),
          publicClient.readContract({
            address: chainConfig.policyManager,
            abi: ArcPolicyManagerAbi,
            functionName: 'getChargeBreakdown',
            args: [policyId],
          }),
        ])

      // Map policy data
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
        endTime,
        active,
        metadataUrl,
      })

      // Map canCharge result
      const [canChargeValue, reason] = canChargeResult as [boolean, string]
      setCanCharge(canChargeValue)
      setCanChargeReason(reason)

      // Set next charge time
      setNextChargeTime(Number(nextChargeResult))

      // Set remaining allowance
      setRemainingAllowance(remainingResult as bigint)

      // Map charge breakdown
      const [total, merchantReceives, protocolFee] = breakdownResult as [bigint, bigint, bigint]
      setChargeBreakdown({ total, merchantReceives, protocolFee })
    } catch (err) {
      console.error('Failed to fetch policy:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch policy')
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, policyId, chainConfig.policyManager])

  // Fetch policy on mount and when dependencies change
  React.useEffect(() => {
    fetchPolicy()
  }, [fetchPolicy])

  return {
    policy,
    canCharge,
    canChargeReason,
    nextChargeTime,
    remainingAllowance,
    chargeBreakdown,
    isLoading,
    error,
    refetch: fetchPolicy,
  }
}
