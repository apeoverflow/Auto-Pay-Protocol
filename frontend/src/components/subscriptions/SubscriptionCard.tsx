import { useState } from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { formatUSDC, formatInterval } from '../../types/subscriptions'
import type { OnChainPolicy } from '../../types/policy'
import type { PolicyMetadata } from '../../hooks'
import { useChain } from '../../hooks'
import { Clock, ExternalLink, Loader2 } from 'lucide-react'

interface SubscriptionCardProps {
  policy: OnChainPolicy
  metadata?: PolicyMetadata | null
  onCancel?: (policyId: `0x${string}`) => void
  isCancelling?: boolean
  compact?: boolean
  onClick?: () => void
}

// Generate color theme based on merchant address
function getMerchantTheme(address: string) {
  const themes = [
    { gradient: 'from-blue-500 to-indigo-500', bg: 'bg-blue-500/8', text: 'text-blue-600' },
    { gradient: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-500/8', text: 'text-emerald-600' },
    { gradient: 'from-violet-500 to-purple-500', bg: 'bg-violet-500/8', text: 'text-violet-600' },
    { gradient: 'from-orange-500 to-amber-500', bg: 'bg-orange-500/8', text: 'text-orange-600' },
    { gradient: 'from-pink-500 to-rose-500', bg: 'bg-pink-500/8', text: 'text-pink-600' },
    { gradient: 'from-cyan-500 to-blue-500', bg: 'bg-cyan-500/8', text: 'text-cyan-600' },
  ]
  // Use last 2 chars of address to pick theme
  const index = parseInt(address.slice(-2), 16) % themes.length
  return themes[index]
}

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Compute the next future charge timestamp.
 * If lastCharged + interval is in the past (relayer already charged but
 * frontend data is stale), fast-forward by whole intervals to the next
 * future occurrence.
 */
function getNextChargeTimestamp(lastCharged: number, interval: number): number {
  const next = lastCharged + interval
  const now = Math.floor(Date.now() / 1000)
  if (next > now) return next
  // Fast-forward past now
  const elapsed = now - lastCharged
  const periods = Math.ceil(elapsed / interval)
  return lastCharged + periods * interval
}

function getRemainingTime(nextChargeTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = nextChargeTimestamp - now

  if (diff < 0) return 'Soon'

  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const mins = Math.floor((diff % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  if (mins > 0) return `~${mins} min${mins !== 1 ? 's' : ''}`
  return '<1 min'
}

export function SubscriptionCard({ policy, metadata, onCancel, isCancelling, compact = false, onClick }: SubscriptionCardProps) {
  const { chainConfig } = useChain()
  const theme = getMerchantTheme(policy.merchant)
  const status = policy.active ? 'active' : 'cancelled'
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)
  const inactive = !policy.active

  const [logoFailed, setLogoFailed] = useState(false)

  // Metadata-derived display values (fall back to address-based defaults)
  const displayName = metadata?.merchant?.name || metadata?.plan?.name || formatAddress(policy.merchant)
  const planName = metadata?.plan?.name
  const merchantLogo = !logoFailed ? metadata?.merchant?.logo : undefined
  const avatarLetters = metadata?.merchant?.name
    ? metadata.merchant.name.slice(0, 2).toUpperCase()
    : policy.merchant.slice(2, 4).toUpperCase()

  // Calculate next charge time (fast-forwards past stale data)
  const nextChargeTime = getNextChargeTimestamp(policy.lastCharged, policy.interval)

  // Build explorer links
  const policyExplorerUrl = `${chainConfig.explorer}/address/${chainConfig.policyManager}`
  const merchantExplorerUrl = `${chainConfig.explorer}/address/${policy.merchant}`

  if (compact) {
    return (
      <div
        className={`flex items-center justify-between py-2.5 md:py-3.5 border-b border-border/40 last:border-0 group row-hover px-1 -mx-1 ${inactive ? 'opacity-50' : ''} ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
      >
        <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
          {merchantLogo ? (
            <img
              src={merchantLogo}
              alt={displayName}
              onError={() => setLogoFailed(true)}
              className={`h-8 w-8 md:h-10 md:w-10 flex-shrink-0 rounded-lg md:rounded-xl object-cover shadow-sm ring-1 ring-black/5 ${inactive ? 'grayscale opacity-50' : ''}`}
            />
          ) : (
            <div className={`flex h-8 w-8 md:h-10 md:w-10 flex-shrink-0 items-center justify-center rounded-lg md:rounded-xl text-white text-xs md:text-sm font-semibold shadow-sm ring-1 ring-black/5 ${inactive ? 'bg-muted-foreground/30 grayscale' : `bg-gradient-to-br ${theme.gradient}`}`}>
              {avatarLetters}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <a
                href={merchantExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[13px] md:text-sm truncate hover:underline"
              >
                {displayName}
              </a>
              <Badge variant={status === 'active' ? 'success' : 'secondary'} className="text-[10px] px-1.5 py-0 font-medium flex-shrink-0">
                {statusLabel}
              </Badge>
            </div>
            <div className="flex items-center gap-2 md:gap-3 text-[11px] md:text-xs text-muted-foreground mt-0.5">
              <span className="font-semibold text-foreground/80">{formatUSDC(policy.chargeAmount)}</span>
              <span className="text-muted-foreground/50">/</span>
              <span>{formatInterval(policy.interval).toLowerCase()}</span>
              {status === 'active' && (
                <span className="flex items-center gap-1 text-muted-foreground/70">
                  <Clock className="h-3 w-3" />
                  {getRemainingTime(nextChargeTime)}
                </span>
              )}
            </div>
          </div>
        </div>
        {status === 'active' && onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onCancel(policy.policyId) }}
            disabled={isCancelling}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 text-xs flex-shrink-0"
          >
            {isCancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Cancel'}
          </Button>
        )}
      </div>
    )
  }

  /* Full card: mobile-optimized, desktop-enhanced */
  return (
    <div
      className={`group relative overflow-hidden rounded-xl border bg-card transition-all duration-200 ${inactive ? 'border-border/40 opacity-50' : 'border-border hover:shadow-md'} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Left accent bar — hover-only for active, hidden for inactive */}
      {!inactive && (
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b ${theme.gradient} rounded-l-xl transition-opacity duration-200 opacity-0 group-hover:opacity-100`} />
      )}

      <div className="flex items-center gap-3 md:gap-3 p-3 md:p-3.5">
        {/* Avatar */}
        {merchantLogo ? (
          <img
            src={merchantLogo}
            alt={displayName}
            onError={() => setLogoFailed(true)}
            className={`h-9 w-9 md:h-10 md:w-10 flex-shrink-0 rounded-lg md:rounded-xl object-cover shadow-sm ring-1 ring-black/5 ${inactive ? 'grayscale opacity-50' : ''}`}
          />
        ) : (
          <div className={`flex h-9 w-9 md:h-10 md:w-10 flex-shrink-0 items-center justify-center rounded-lg md:rounded-xl font-semibold text-xs md:text-sm shadow-sm ring-1 ring-black/5 ${inactive ? 'bg-muted-foreground/25 text-muted-foreground/60' : `bg-gradient-to-br ${theme.gradient} text-white`}`}>
            {avatarLetters}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <a
              href={merchantExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[13px] md:text-[14px] truncate hover:underline"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {displayName}
            </a>
            <Badge variant={status === 'active' ? 'success' : 'secondary'} className="text-[10px] px-1.5 py-0 font-medium flex-shrink-0">
              {statusLabel}
            </Badge>
            <a
              href={policyExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 md:gap-2.5 text-[11px] md:text-xs text-muted-foreground mt-0.5">
            {planName && metadata?.merchant?.name && (
              <>
                <span className="font-medium text-foreground/60">{planName}</span>
                <span className="text-muted-foreground/30">&middot;</span>
              </>
            )}
            <span className="font-semibold text-foreground/80 tabular-nums">{formatUSDC(policy.chargeAmount)}</span>
            <span className="text-muted-foreground/30">/</span>
            <span className="font-medium">{formatInterval(policy.interval)}</span>
            {status === 'active' && (
              <>
                <span className="text-muted-foreground/30">&middot;</span>
                <span className="flex items-center gap-1 text-muted-foreground/60">
                  <Clock className="h-3 w-3" />
                  {getRemainingTime(nextChargeTime)}
                </span>
              </>
            )}
            <span className="text-muted-foreground/30">&middot;</span>
            <span className="text-muted-foreground/60 tabular-nums">
              {policy.chargeCount} charge{policy.chargeCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Cancel button — right side, close to content */}
        {status === 'active' && onCancel && (
          <>
            {/* Desktop */}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onCancel(policy.policyId) }}
              disabled={isCancelling}
              className="hidden md:inline-flex text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 text-xs flex-shrink-0"
            >
              {isCancelling ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </Button>
            {/* Mobile */}
            <button
              onClick={(e) => { e.stopPropagation(); onCancel(policy.policyId) }}
              disabled={isCancelling}
              className="md:hidden text-[11px] font-medium text-muted-foreground/60 hover:text-destructive transition-colors flex-shrink-0 disabled:opacity-50"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
