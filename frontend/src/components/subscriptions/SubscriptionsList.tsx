import * as React from 'react'
import { SubscriptionCard } from './SubscriptionCard'
import { SubscriptionDetail } from './SubscriptionDetail'
import { usePolicies, useRevokePolicy, useMetadataBatch, invalidateActivity } from '../../hooks'
import type { OnChainPolicy } from '../../types/policy'
import { Loader2, Sparkles } from 'lucide-react'

interface SubscriptionsListProps {
  showAll?: boolean
  compact?: boolean
}

export function SubscriptionsList({ showAll = false, compact = false }: SubscriptionsListProps) {
  const { policies, isLoading, refreshPolicyFromContract } = usePolicies()
  const { revokePolicy, isLoading: isRevoking } = useRevokePolicy()
  const [revokingId, setRevokingId] = React.useState<`0x${string}` | null>(null)
  const [selectedPolicy, setSelectedPolicy] = React.useState<OnChainPolicy | null>(null)

  // Fetch metadata for all policies that have a metadataUrl
  const metadataUrls = React.useMemo(() => policies.map(p => p.metadataUrl || null), [policies])
  const metadataMap = useMetadataBatch(metadataUrls)

  const displayPolicies = showAll
    ? policies
    : policies.filter(p => p.active).slice(0, compact ? 5 : 3)

  const handleCancel = async (policyId: `0x${string}`) => {
    try {
      setRevokingId(policyId)
      await revokePolicy(policyId)
      // Read updated policy state directly from contract (bypasses Supabase indexer delay)
      await refreshPolicyFromContract(policyId)
      // Trigger activity refresh across all instances
      invalidateActivity()
      setSelectedPolicy(null)
    } catch (err) {
      console.error('Failed to cancel subscription:', err)
    } finally {
      setRevokingId(null)
    }
  }

  // For filtered views (dashboard), check displayPolicies; for full view, check policies
  const isEmpty = showAll ? policies.length === 0 : displayPolicies.length === 0

  if (isLoading && policies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-6">
        {/* Decorative illustration */}
        <div className="relative mb-5">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/20 animate-[spin_20s_linear_infinite]" style={{ width: 72, height: 72, margin: -8 }} />
          {/* Icon container */}
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10">
            <Sparkles className="h-6 w-6 text-primary/60" />
          </div>
          {/* Floating dots */}
          <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary/30" />
          <div className="absolute -bottom-0.5 -left-1.5 h-1.5 w-1.5 rounded-full bg-primary/20" />
        </div>

        <h3 className="text-[15px] font-semibold text-foreground/90">No active subscriptions</h3>
        <p className="mt-1.5 text-[13px] text-muted-foreground text-center max-w-[220px] leading-relaxed">
          Your recurring payments will appear here once you subscribe to a service
        </p>
      </div>
    )
  }

  return (
    <>
      <div className={compact ? 'space-y-0' : 'space-y-2.5 md:space-y-3'}>
        {displayPolicies.map(policy => (
          <SubscriptionCard
            key={policy.policyId}
            policy={policy}
            metadata={policy.metadataUrl ? metadataMap.get(policy.metadataUrl) : null}
            onCancel={handleCancel}
            isCancelling={revokingId === policy.policyId && isRevoking}
            compact={compact}
            onClick={() => setSelectedPolicy(policy)}
          />
        ))}
      </div>

      {/* Detail drawer */}
      {selectedPolicy && (
        <SubscriptionDetail
          policy={selectedPolicy}
          metadata={selectedPolicy.metadataUrl ? metadataMap.get(selectedPolicy.metadataUrl) : null}
          open={!!selectedPolicy}
          onOpenChange={(open) => { if (!open) setSelectedPolicy(null) }}
          onCancel={handleCancel}
          isCancelling={revokingId === selectedPolicy.policyId && isRevoking}
        />
      )}
    </>
  )
}
