import * as React from 'react'
import { SubscriptionCard } from '../components/subscriptions/SubscriptionCard'
import { usePolicies, useRevokePolicy, useChain, useMetadataBatch, invalidateActivity } from '../hooks'
import type { OnChainPolicy } from '../types/policy'
import { Search, CreditCard, Loader2, ExternalLink } from 'lucide-react'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'

type StatusFilter = 'all' | 'active' | 'cancelled'

const filterLabels: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'cancelled', label: 'Past' },
]

export function SubscriptionsPage() {
  const { policies, isLoading, error, refetch, refreshPolicyFromContract } = usePolicies()
  const { revokePolicy, isLoading: isRevoking } = useRevokePolicy()
  const { chainConfig } = useChain()
  const metadataUrls = React.useMemo(() => policies.map(p => p.metadataUrl || null), [policies])
  const metadataMap = useMetadataBatch(metadataUrls)
  const [filter, setFilter] = React.useState<StatusFilter>('all')
  const [search, setSearch] = React.useState('')
  const [revokingId, setRevokingId] = React.useState<`0x${string}` | null>(null)

  const handleCancel = async (policyId: `0x${string}`) => {
    try {
      setRevokingId(policyId)
      await revokePolicy(policyId)
      // Refresh policy state from contract (don't wait for indexer)
      await refreshPolicyFromContract(policyId)
      invalidateActivity()
    } catch (err) {
      console.error('Failed to cancel subscription:', err)
    } finally {
      setRevokingId(null)
    }
  }

  const filtered = React.useMemo(() => {
    let result = policies

    // Status filter
    if (filter === 'active') {
      result = result.filter(p => p.active)
    } else if (filter === 'cancelled') {
      result = result.filter(p => !p.active)
    }

    // Search by merchant name, address, or metadata URL
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(p => {
        const meta = p.metadataUrl ? metadataMap.get(p.metadataUrl) : undefined
        const name = meta?.merchant?.name || meta?.plan?.name || ''
        return (
          name.toLowerCase().includes(q) ||
          p.merchant.toLowerCase().includes(q) ||
          p.metadataUrl.toLowerCase().includes(q) ||
          p.policyId.toLowerCase().includes(q)
        )
      })
    }

    return result
  }, [policies, filter, search, metadataMap])

  const counts = React.useMemo(() => ({
    all: policies.length,
    active: policies.filter(p => p.active).length,
    cancelled: policies.filter(p => !p.active).length,
  }), [policies])

  if (isLoading && policies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Loading subscriptions...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <CreditCard className="h-5 w-5 text-destructive" />
        </div>
        <h3 className="mt-4 font-semibold text-sm">Failed to load subscriptions</h3>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={refetch}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 md:gap-5">
      {/* Header area */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground hidden md:block">
            Manage your active and past subscriptions
          </p>
          <a
            href={`${chainConfig.explorer}/address/${chainConfig.policyManager}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="hidden sm:inline">Contract</span>
          </a>
        </div>
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
          {filtered.map(policy => (
            <SubscriptionCard
              key={policy.policyId}
              policy={policy}
              metadata={policy.metadataUrl ? metadataMap.get(policy.metadataUrl) : null}
              onCancel={handleCancel}
              isCancelling={revokingId === policy.policyId && isRevoking}
            />
          ))}
        </div>
      )}
    </div>
  )
}
