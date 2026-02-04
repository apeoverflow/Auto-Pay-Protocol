import * as React from 'react'
import { SubscriptionCard } from './SubscriptionCard'
import { usePolicies, useRevokePolicy } from '../../hooks'
import { CreditCard, Loader2 } from 'lucide-react'

interface SubscriptionsListProps {
  showAll?: boolean
  compact?: boolean
}

export function SubscriptionsList({ showAll = false, compact = false }: SubscriptionsListProps) {
  const { policies, isLoading, refetch } = usePolicies()
  const { revokePolicy, isLoading: isRevoking } = useRevokePolicy()
  const [revokingId, setRevokingId] = React.useState<`0x${string}` | null>(null)

  const displayPolicies = showAll
    ? policies
    : policies.filter(p => p.active).slice(0, compact ? 5 : 3)

  const handleCancel = async (policyId: `0x${string}`) => {
    try {
      setRevokingId(policyId)
      await revokePolicy(policyId)
      await refetch()
    } catch (err) {
      console.error('Failed to cancel subscription:', err)
    } finally {
      setRevokingId(null)
    }
  }

  if (isLoading && policies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (policies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="mt-3 font-medium text-sm">No subscriptions yet</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Subscribe to services using your wallet
        </p>
      </div>
    )
  }

  return (
    <div className={compact ? 'space-y-0' : 'space-y-2.5 md:space-y-3'}>
      {displayPolicies.map(policy => (
        <SubscriptionCard
          key={policy.policyId}
          policy={policy}
          onCancel={handleCancel}
          isCancelling={revokingId === policy.policyId && isRevoking}
          compact={compact}
        />
      ))}
    </div>
  )
}
