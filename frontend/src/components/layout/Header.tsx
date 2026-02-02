import { useWallet } from '../../hooks'
import { Button } from '../ui/button'
import { Copy, Check, RefreshCw, Menu } from 'lucide-react'
import * as React from 'react'
import type { NavItem } from './Sidebar'

interface HeaderProps {
  currentPage?: NavItem
  onMenuToggle?: () => void
}

const pageTitles: Record<NavItem, string> = {
  dashboard: 'Dashboard',
  subscriptions: 'Subscriptions',
  activity: 'Activity',
  settings: 'Settings',
}

export function Header({ currentPage = 'dashboard', onMenuToggle }: HeaderProps) {
  const { account, balance, fetchBalance } = useWallet()
  const [copied, setCopied] = React.useState(false)
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  const handleCopy = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchBalance()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatBalance = (bal: string | null) => {
    if (bal === null) return '0.00'
    const value = parseFloat(bal)
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return (
    <header className="flex h-14 md:h-16 items-center justify-between border-b border-border/50 bg-white/80 backdrop-blur-sm px-3 md:px-6">
      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={onMenuToggle}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base md:text-lg font-semibold tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>{pageTitles[currentPage]}</h1>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Balance pill — compact on mobile, full on desktop */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/60 px-2.5 sm:px-4 py-1.5 sm:py-2 shadow-sm shadow-blue-500/5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
            <span className="text-[10px] font-bold text-white">$</span>
          </div>
          <span className="text-xs sm:text-sm font-semibold text-foreground tabular-nums">{formatBalance(balance)}</span>
          <span className="hidden sm:inline text-xs text-muted-foreground font-medium">USDC</span>
        </div>

        {/* Refresh */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full"
          onClick={handleRefresh}
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>

        {/* Divider */}
        <div className="hidden sm:block h-6 w-px bg-border/50" />

        {/* Wallet address — desktop only */}
        <button
          onClick={handleCopy}
          className="hidden sm:flex items-center gap-1.5 rounded-full bg-muted/30 border border-border/50 px-3 py-1.5 transition-colors hover:bg-muted/50 active:bg-muted/60"
        >
          <span className="font-mono text-xs text-muted-foreground">
            {account?.address && formatAddress(account.address)}
          </span>
          {copied ? (
            <Check className="h-3 w-3 text-success flex-shrink-0" />
          ) : (
            <Copy className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )}
        </button>
      </div>
    </header>
  )
}
