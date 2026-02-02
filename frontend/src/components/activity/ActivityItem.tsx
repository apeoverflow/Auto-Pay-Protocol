import { Badge } from '../ui/badge'
import { formatUSDC } from '../../types/subscriptions'
import type { ActivityItem as ActivityItemType } from '../../types/subscriptions'
import {
  CreditCard,
  Plus,
  XCircle,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react'

interface ActivityItemProps {
  item: ActivityItemType
  compact?: boolean
}

const typeConfig: Record<ActivityItemType['type'], {
  icon: React.ReactNode
  label: string
  color: string
  bgColor: string
}> = {
  charge: {
    icon: <CreditCard className="h-3.5 w-3.5" />,
    label: 'Charged',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
  },
  subscribe: {
    icon: <Plus className="h-3.5 w-3.5" />,
    label: 'Subscribed',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
  },
  cancel: {
    icon: <XCircle className="h-3.5 w-3.5" />,
    label: 'Cancelled',
    color: 'text-red-600',
    bgColor: 'bg-red-500/10',
  },
  transfer: {
    icon: <ArrowUpRight className="h-3.5 w-3.5" />,
    label: 'Sent',
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10',
  },
}

const statusVariants: Record<ActivityItemType['status'], 'success' | 'warning' | 'destructive'> = {
  confirmed: 'success',
  pending: 'warning',
  failed: 'destructive',
}

export function ActivityItemRow({ item, compact = false }: ActivityItemProps) {
  const config = typeConfig[item.type]

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  const truncateHash = (hash: string) => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`
  }

  const explorerUrl = `https://amoy.polygonscan.com/tx/${item.txHash}`

  if (compact) {
    return (
      <div className="flex items-center gap-2.5 py-2.5 row-hover px-1 -mx-1">
        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${config.bgColor} ${config.color}`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-[13px] truncate" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {config.label}
            </span>
            {item.merchant && (
              <span className="text-[11px] text-muted-foreground/70 truncate">{item.merchant}</span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground/50">{formatDate(item.timestamp)}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.amount !== undefined && (
            <span className="font-semibold tabular-nums text-[13px]">
              {item.type === 'transfer' ? '-' : ''}{formatUSDC(item.amount)}
            </span>
          )}
          <Badge variant={statusVariants[item.status]} className="text-[9px] px-1.5 py-0 font-medium">
            {item.status}
          </Badge>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 sm:gap-4 py-3.5 sm:py-4 row-hover px-2 -mx-2">
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${config.bgColor} ${config.color} ring-1 ring-black/[0.03]`}>
        {config.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <span className="font-semibold text-sm sm:text-[15px]">{config.label}</span>
          {item.merchant && (
            <span className="text-muted-foreground text-sm">- {item.merchant}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-0.5">
          <span>{formatDate(item.timestamp)}</span>
          <span className="hidden sm:inline text-muted-foreground/40">-</span>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1 hover:text-primary transition-colors font-mono text-xs"
          >
            {truncateHash(item.txHash)}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {item.amount !== undefined && (
          <div className="text-right">
            <span className="font-semibold tabular-nums text-sm sm:text-[15px]">
              {item.type === 'transfer' ? '-' : ''}{formatUSDC(item.amount)}
            </span>
            <p className="hidden sm:block text-xs text-muted-foreground/70">{item.token}</p>
          </div>
        )}

        <Badge variant={statusVariants[item.status]} className="capitalize font-medium text-[10px] sm:text-xs">
          {item.status}
        </Badge>
      </div>
    </div>
  )
}
