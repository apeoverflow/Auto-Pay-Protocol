import * as React from 'react'
import type { TransactionReceipt } from 'viem'
import { usePolicies } from './usePolicies'
import { useRevokePolicy } from './useRevokePolicy'
import { useUpdateSpendingCap } from './useUpdateSpendingCap'
import { useWallet } from './useWallet'
import { UNLIMITED_APPROVAL_THRESHOLD } from '../config'
import type { OnChainPolicy } from '../types/policy'

interface UseSubscriptionDetailControllerOptions {
  /**
   * Called when a cancel transaction confirms. Used to feed the receipt into
   * activity lists / refresh logic — different surfaces want different things
   * (e.g. the page does optimistic activity hydration, the dashboard list
   * fires a global invalidate).
   */
  onCancelSuccess?: (receipt: TransactionReceipt) => void
}

interface UseSubscriptionDetailControllerReturn {
  // Policies pass-through
  policies: OnChainPolicy[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  refreshPolicyFromContract: (policyId: `0x${string}`) => Promise<void>

  // Detail modal selection
  selectedPolicy: OnChainPolicy | null
  openPolicy: (policy: OnChainPolicy) => void
  closeDetail: () => void

  // Mutating actions
  handleCancel: (policyId: `0x${string}`) => Promise<void>
  handleUpdateCap: (policyId: `0x${string}`, newCap: bigint) => Promise<void>

  // Loading flags
  isCancelling: boolean
  isUpdatingCap: boolean
  revokingId: `0x${string}` | null
}

/**
 * Owns the orchestration shared by every place that opens a SubscriptionDetail:
 * the selected-policy snapshot (with stale-after-update re-sync), revoke + cap
 * update handlers, and coordinated wallet-allowance bump when raising a cap.
 *
 * Consumers still render their own SubscriptionCard / list / search UI — this
 * hook just wires the controller half.
 */
export function useSubscriptionDetailController(
  opts: UseSubscriptionDetailControllerOptions = {}
): UseSubscriptionDetailControllerReturn {
  const { policies, isLoading, error, refetch, refreshPolicyFromContract } = usePolicies()
  const { revokePolicy, isLoading: isRevoking } = useRevokePolicy()
  const { updateSpendingCap, isLoading: isUpdatingCap } = useUpdateSpendingCap()
  const { allowance, setupWallet } = useWallet()

  const [selectedPolicy, setSelectedPolicy] = React.useState<OnChainPolicy | null>(null)
  const [revokingId, setRevokingId] = React.useState<`0x${string}` | null>(null)

  // Stash the caller's onCancelSuccess in a ref so an inline object literal in
  // the consumer (the common case) doesn't invalidate handleCancel every render
  // and cascade re-renders through every SubscriptionCard.
  const onCancelSuccessRef = React.useRef(opts.onCancelSuccess)
  React.useEffect(() => {
    onCancelSuccessRef.current = opts.onCancelSuccess
  }, [opts.onCancelSuccess])

  // Keep the open detail snapshot in sync when its underlying policy refreshes
  // (e.g. after a cap update or refreshPolicyFromContract). React bails on
  // identical references, so this self-stabilises.
  React.useEffect(() => {
    if (!selectedPolicy) return
    const fresh = policies.find((p) => p.policyId === selectedPolicy.policyId)
    if (fresh && fresh !== selectedPolicy) setSelectedPolicy(fresh)
  }, [policies, selectedPolicy])

  const handleCancel = React.useCallback(
    async (policyId: `0x${string}`) => {
      try {
        setRevokingId(policyId)
        const { receipt } = await revokePolicy(policyId)
        onCancelSuccessRef.current?.(receipt)
        await refreshPolicyFromContract(policyId)
        setSelectedPolicy(null)
      } catch (err) {
        console.error('Failed to cancel subscription:', err)
      } finally {
        setRevokingId(null)
      }
    },
    [revokePolicy, refreshPolicyFromContract]
  )

  const handleUpdateCap = React.useCallback(
    async (policyId: `0x${string}`, newCap: bigint) => {
      // Adjust the wallet-wide allowance to track this sub's cap change without
      // overwriting other subs' commitments. Wallet allowance ≈ Σ remaining
      // caps of active finite-cap policies, so a cap raise of `delta` means
      // adding `delta` to the wallet allowance; a cap lower is a no-op
      // (over-approval is harmless). Switching a sub to unlimited (newCap=0n)
      // implies the wallet must also be unlimited.
      const policy = policies.find((p) => p.policyId === policyId)
      const oldCap = policy?.spendingCap ?? 0n

      if (allowance < UNLIMITED_APPROVAL_THRESHOLD) {
        if (newCap === 0n) {
          await setupWallet() // undefined → unlimited (maxUint256 / maxUint128)
        } else if (oldCap > 0n && newCap > oldCap) {
          const delta = newCap - oldCap
          await setupWallet(allowance + delta)
        }
        // oldCap === 0n (unlimited → finite): no allowance action; wallet may
        // already be unlimited, finite cap is more restrictive than allowance.
        // newCap < oldCap (lowering): no allowance action.
      }

      await updateSpendingCap(policyId, newCap)
      await refreshPolicyFromContract(policyId)
    },
    [policies, allowance, setupWallet, updateSpendingCap, refreshPolicyFromContract]
  )

  const closeDetail = React.useCallback(() => setSelectedPolicy(null), [])

  return {
    policies,
    isLoading,
    error,
    refetch,
    refreshPolicyFromContract,
    selectedPolicy,
    openPolicy: setSelectedPolicy,
    closeDetail,
    handleCancel,
    handleUpdateCap,
    isCancelling: isRevoking,
    isUpdatingCap,
    revokingId,
  }
}
