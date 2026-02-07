import * as React from 'react'
import { Card, CardContent } from '../ui/card'
import { ActivityItemRow } from './ActivityItem'
import { useActivity, useMetadataBatch } from '../../hooks'
import type { ActivityItem } from '../../types/subscriptions'
import { Activity, Filter, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'

interface ActivityListProps {
  showAll?: boolean
  limit?: number
  compact?: boolean
}

type FilterType = 'all' | 'charges' | 'transfers'

const filterLabels: Record<FilterType, string> = {
  all: 'All',
  charges: 'Charges',
  transfers: 'Transfers',
}

const PAGE_SIZE = 8

export function ActivityList({ showAll = false, limit = 5, compact = false }: ActivityListProps) {
  const { activity, isLoading, error } = useActivity()
  const metadataUrls = React.useMemo(() => activity.map(a => a.metadataUrl || null), [activity])
  const metadataMap = useMetadataBatch(metadataUrls)
  const [filter, setFilter] = React.useState<FilterType>('all')
  const [page, setPage] = React.useState(0)

  // Reset page when filter changes
  React.useEffect(() => { setPage(0) }, [filter])

  const filteredActivity = React.useMemo(() => {
    let filtered = activity

    switch (filter) {
      case 'charges':
        filtered = activity.filter(a => a.type === 'charge' || a.type === 'subscribe' || a.type === 'cancel')
        break
      case 'transfers':
        filtered = activity.filter(a => a.type === 'transfer')
        break
    }

    return filtered
  }, [activity, filter])

  const totalPages = Math.ceil(filteredActivity.length / PAGE_SIZE)

  const displayedActivity = React.useMemo(() => {
    if (!showAll) return filteredActivity.slice(0, limit)
    const start = page * PAGE_SIZE
    return filteredActivity.slice(start, start + PAGE_SIZE)
  }, [filteredActivity, showAll, limit, page])

  if (isLoading && activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Loading activity...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <Activity className="h-5 w-5 text-destructive" />
        </div>
        <h3 className="mt-4 font-semibold text-sm">Failed to load activity</h3>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Activity className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-semibold text-sm">No activity yet</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Your transaction history will appear here
        </p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="divide-y divide-border/50">
        {displayedActivity.map(item => (
          <div key={item.id} className="px-4">
            <ActivityItemRow item={item} compact metadata={item.metadataUrl ? metadataMap.get(item.metadataUrl) : undefined} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <Card>
        {showAll && (
          <div className="flex items-center gap-2 px-4 md:px-5 py-3 border-b border-border/40">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
              {(Object.keys(filterLabels) as FilterType[]).map((key) => (
                <Button
                  key={key}
                  variant={filter === key ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter(key)}
                  className={filter === key
                    ? 'h-7 text-xs shadow-sm'
                    : 'h-7 text-xs text-muted-foreground hover:text-foreground'
                  }
                >
                  {filterLabels[key]}
                </Button>
              ))}
            </div>
          </div>
        )}
        <CardContent className="divide-y divide-border/40 p-0">
          {displayedActivity.map(item => (
            <div key={item.id} className="px-4 md:px-5">
              <ActivityItemRow item={item} metadata={item.metadataUrl ? metadataMap.get(item.metadataUrl) : undefined} />
            </div>
          ))}
        </CardContent>

        {/* Pagination */}
        {showAll && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border/40 px-4 md:px-5 py-3">
            <span className="text-xs text-muted-foreground">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredActivity.length)} of {filteredActivity.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => (
                <Button
                  key={i}
                  variant={page === i ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0 text-xs"
                  onClick={() => setPage(i)}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page === totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
