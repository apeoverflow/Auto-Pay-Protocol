import * as React from 'react'
import { SubscriptionCard } from '../components/subscriptions/SubscriptionCard'
import { mockSubscriptions } from '../mocks/data'
import type { Subscription } from '../types/subscriptions'
import { Search, CreditCard } from 'lucide-react'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'

type StatusFilter = 'all' | 'active' | 'paused' | 'cancelled' | 'failed'

const filterLabels: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'cancelled', label: 'Past' },
]

export function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = React.useState<Subscription[]>(mockSubscriptions)
  const [filter, setFilter] = React.useState<StatusFilter>('all')
  const [search, setSearch] = React.useState('')

  const handleCancel = (id: string) => {
    setSubscriptions(prev =>
      prev.map(sub =>
        sub.id === id ? { ...sub, status: 'cancelled' as const } : sub
      )
    )
  }

  const filtered = React.useMemo(() => {
    let result = subscriptions

    // Status filter
    if (filter === 'cancelled') {
      result = result.filter(s => s.status === 'cancelled' || s.status === 'failed')
    } else if (filter !== 'all') {
      result = result.filter(s => s.status === filter)
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.plan.merchantName.toLowerCase().includes(q) ||
        s.plan.name.toLowerCase().includes(q)
      )
    }

    return result
  }, [subscriptions, filter, search])

  const counts = React.useMemo(() => ({
    all: subscriptions.length,
    active: subscriptions.filter(s => s.status === 'active').length,
    paused: subscriptions.filter(s => s.status === 'paused').length,
    cancelled: subscriptions.filter(s => s.status === 'cancelled' || s.status === 'failed').length,
    failed: 0,
  }), [subscriptions])

  return (
    <div className="flex flex-col gap-3 md:gap-5">
      {/* Header area */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground hidden md:block">
          Manage your active and past subscriptions
        </p>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subscriptions..."
            className="pl-9 bg-white h-9 md:h-10 text-[13px] md:text-sm"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide -mx-3 px-3 md:mx-0 md:px-0">
        {filterLabels.map(({ key, label }) => (
          <Button
            key={key}
            variant={filter === key ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter(key)}
            className={
              filter === key
                ? 'h-8 text-[12px] md:text-xs shadow-sm flex-shrink-0 rounded-lg'
                : 'h-8 text-[12px] md:text-xs text-muted-foreground hover:text-foreground flex-shrink-0 rounded-lg'
            }
          >
            {label}
            {counts[key] > 0 && (
              <span className={`ml-1.5 tabular-nums ${filter === key ? 'text-primary-foreground/70' : 'text-muted-foreground/50'}`}>
                {counts[key]}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Subscription cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="mt-4 font-semibold text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {search ? 'No matching subscriptions' : 'No subscriptions'}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {search ? 'Try a different search term' : 'Subscribe to services using your wallet'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 md:space-y-2.5">
          {filtered.map(subscription => (
            <SubscriptionCard
              key={subscription.id}
              subscription={subscription}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}
    </div>
  )
}
