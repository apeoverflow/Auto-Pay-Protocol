import * as React from 'react'
import { SubscriptionCard } from './SubscriptionCard'
import { mockSubscriptions } from '../../mocks/data'
import type { Subscription } from '../../types/subscriptions'
import { CreditCard } from 'lucide-react'

interface SubscriptionsListProps {
  showAll?: boolean
  compact?: boolean
}

export function SubscriptionsList({ showAll = false, compact = false }: SubscriptionsListProps) {
  const [subscriptions, setSubscriptions] = React.useState<Subscription[]>(mockSubscriptions)

  const displaySubscriptions = showAll
    ? subscriptions
    : subscriptions.filter(s => s.status === 'active').slice(0, compact ? 5 : 3)

  const handleCancel = (id: string) => {
    setSubscriptions(prev =>
      prev.map(sub =>
        sub.id === id ? { ...sub, status: 'cancelled' as const } : sub
      )
    )
  }

  if (subscriptions.length === 0) {
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
      {displaySubscriptions.map(subscription => (
        <SubscriptionCard
          key={subscription.id}
          subscription={subscription}
          onCancel={handleCancel}
          compact={compact}
        />
      ))}
    </div>
  )
}
