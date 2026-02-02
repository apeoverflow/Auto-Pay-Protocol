import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { formatUSDC, formatInterval, getRemainingTime } from '../../types/subscriptions'
import type { Subscription } from '../../types/subscriptions'
import { Clock, MoreHorizontal } from 'lucide-react'

interface SubscriptionCardProps {
  subscription: Subscription
  onCancel?: (id: string) => void
  compact?: boolean
}

const statusVariants: Record<Subscription['status'], 'success' | 'warning' | 'destructive' | 'secondary'> = {
  active: 'success',
  paused: 'warning',
  cancelled: 'secondary',
  failed: 'destructive',
}

const merchantColors: Record<string, { gradient: string; bg: string; text: string }> = {
  S: { gradient: 'from-blue-500 to-indigo-500', bg: 'bg-blue-500/8', text: 'text-blue-600' },
  C: { gradient: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-500/8', text: 'text-emerald-600' },
  D: { gradient: 'from-violet-500 to-purple-500', bg: 'bg-violet-500/8', text: 'text-violet-600' },
  N: { gradient: 'from-orange-500 to-amber-500', bg: 'bg-orange-500/8', text: 'text-orange-600' },
  F: { gradient: 'from-pink-500 to-rose-500', bg: 'bg-pink-500/8', text: 'text-pink-600' },
  V: { gradient: 'from-amber-500 to-yellow-500', bg: 'bg-amber-500/8', text: 'text-amber-600' },
}

function getMerchantTheme(name: string) {
  const letter = name.charAt(0).toUpperCase()
  return merchantColors[letter] || { gradient: 'from-gray-500 to-slate-500', bg: 'bg-gray-500/8', text: 'text-gray-600' }
}

export function SubscriptionCard({ subscription, onCancel, compact = false }: SubscriptionCardProps) {
  const { plan, status, nextCharge } = subscription
  const theme = getMerchantTheme(plan.merchantName)
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)
  const inactive = status === 'cancelled' || status === 'failed' || status === 'paused'

  if (compact) {
    return (
      <div className={`flex items-center justify-between py-2.5 md:py-3.5 border-b border-border/40 last:border-0 group row-hover px-1 -mx-1 ${inactive ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
          <div className={`flex h-8 w-8 md:h-10 md:w-10 flex-shrink-0 items-center justify-center rounded-lg md:rounded-xl text-white text-xs md:text-sm font-semibold shadow-sm ring-1 ring-black/5 ${inactive ? 'bg-muted-foreground/30 grayscale' : `bg-gradient-to-br ${theme.gradient}`}`}>
            {plan.merchantName.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="font-semibold text-[13px] md:text-sm truncate">{plan.merchantName}</span>
              <Badge variant={statusVariants[status]} className="text-[10px] px-1.5 py-0 font-medium flex-shrink-0">
                {statusLabel}
              </Badge>
            </div>
            <div className="flex items-center gap-2 md:gap-3 text-[11px] md:text-xs text-muted-foreground mt-0.5">
              <span className="font-semibold text-foreground/80">{formatUSDC(plan.amount)}</span>
              <span className="text-muted-foreground/50">/</span>
              <span>{formatInterval(plan.interval).toLowerCase()}</span>
              {status === 'active' && (
                <span className="flex items-center gap-1 text-muted-foreground/70">
                  <Clock className="h-3 w-3" />
                  {getRemainingTime(nextCharge)}
                </span>
              )}
            </div>
          </div>
        </div>
        {status === 'active' && onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel(subscription.id)}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 text-xs flex-shrink-0"
          >
            Cancel
          </Button>
        )}
      </div>
    )
  }

  /* ── Full card: mobile-optimized, desktop-enhanced ── */
  return (
    <div className={`group relative overflow-hidden rounded-xl border bg-card transition-all duration-200 ${inactive ? 'border-border/40 opacity-50' : 'border-border hover:shadow-md'}`}>
      {/* Left accent bar — hover-only for active, hidden for inactive */}
      {!inactive && (
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b ${theme.gradient} rounded-l-xl transition-opacity duration-200 opacity-0 group-hover:opacity-100`} />
      )}

      <div className="flex items-center gap-3 md:gap-3 p-3 md:p-3.5">
        {/* Avatar */}
        <div className={`flex h-9 w-9 md:h-10 md:w-10 flex-shrink-0 items-center justify-center rounded-lg md:rounded-xl font-semibold text-xs md:text-sm shadow-sm ring-1 ring-black/5 ${inactive ? 'bg-muted-foreground/25 text-muted-foreground/60' : `bg-gradient-to-br ${theme.gradient} text-white`}`}>
          {plan.merchantName.charAt(0)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold text-[13px] md:text-[14px] truncate" style={{ fontFamily: "'DM Sans', sans-serif" }}>{plan.merchantName}</h3>
            <Badge variant={statusVariants[status]} className="text-[10px] px-1.5 py-0 font-medium flex-shrink-0">
              {statusLabel}
            </Badge>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 md:gap-2.5 text-[11px] md:text-xs text-muted-foreground mt-0.5">
            <span className="font-semibold text-foreground/80 tabular-nums">{formatUSDC(plan.amount)}</span>
            <span className="text-muted-foreground/30">/</span>
            <span className="font-medium">{formatInterval(plan.interval)}</span>
            {status === 'active' && (
              <>
                <span className="text-muted-foreground/30">&middot;</span>
                <span className="flex items-center gap-1 text-muted-foreground/60">
                  <Clock className="h-3 w-3" />
                  {getRemainingTime(nextCharge)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Cancel button — right side, close to content */}
        {status === 'active' && onCancel && (
          <>
            {/* Desktop */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCancel(subscription.id)}
              className="hidden md:inline-flex text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 text-xs flex-shrink-0"
            >
              Cancel
            </Button>
            {/* Mobile */}
            <button
              onClick={() => onCancel(subscription.id)}
              className="md:hidden text-[11px] font-medium text-muted-foreground/60 hover:text-destructive transition-colors flex-shrink-0"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}
