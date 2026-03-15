import { useWallet, useChain } from '../../hooks'
import { Button } from '../ui/button'
import { ChainSelector } from '../chain/ChainSelector'
import { Copy, Check, RefreshCw, Menu, HelpCircle } from 'lucide-react'
import * as React from 'react'
import type { NavItem } from './Sidebar'
import { evmToSS58, shortenSS58 } from '../../lib/ss58'

const POLKADOT_HUB_CHAIN_ID = 420420419

interface HeaderProps {
  currentPage?: NavItem
  onMenuToggle?: () => void
}

const pageTitles: Record<NavItem, string> = {
  dashboard: 'Dashboard',
  subscriptions: 'Subscriptions',
  activity: 'Activity',
  bridge: 'Bridge Funds',
  demo: 'SDK Demo',
  docs: 'Documentation',
  settings: 'Settings',
  'merchant-overview': 'Merchant Overview',
  'merchant-plans': 'Plans',
  'merchant-receipts': 'Receipts',
  'merchant-reports': 'Reports',
  'merchant-subscribers': 'Subscribers',
  'merchant-settings': 'Merchant Settings',
}

export function Header({ currentPage = 'dashboard', onMenuToggle }: HeaderProps) {
  const { address, balance, fetchBalance } = useWallet()
  const { chainConfig } = useChain()
  const [copied, setCopied] = React.useState(false)
  const [copiedUsdc, setCopiedUsdc] = React.useState(false)
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  const isPolkadot = chainConfig.chain.id === POLKADOT_HUB_CHAIN_ID
  const ss58Address = isPolkadot && address ? evmToSS58(address) : null
  const [showTooltip, setShowTooltip] = React.useState(false)

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(ss58Address || address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchBalance()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
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
    <header className="relative z-50 flex h-14 md:h-16 items-center justify-between border-b border-border/50 bg-white/80 backdrop-blur-sm px-3 md:px-6">
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
        {/* Chain selector */}
        <ChainSelector />

        {/* Balance pill — click to copy USDC contract address */}
        <button
          onClick={() => {
            navigator.clipboard.writeText(chainConfig.usdc)
            setCopiedUsdc(true)
            setTimeout(() => setCopiedUsdc(false), 2000)
          }}
          title={`USDC: ${chainConfig.usdc}`}
          className="flex items-center gap-1.5 sm:gap-2.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/60 px-2.5 sm:px-4 py-1.5 sm:py-2 shadow-sm shadow-blue-500/5 transition-all hover:shadow-md hover:border-blue-200/80 active:scale-[0.97] cursor-pointer"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
            {copiedUsdc ? (
              <Check className="h-2.5 w-2.5 text-white" />
            ) : (
              <span className="text-[10px] font-bold text-white">$</span>
            )}
          </div>
          <span className="text-xs sm:text-sm font-semibold text-foreground tabular-nums">{formatBalance(balance)}</span>
          <span className="hidden sm:inline text-xs text-muted-foreground font-medium">USDC</span>
        </button>

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
        <div className="hidden sm:flex items-center gap-1 relative">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-full bg-muted/30 border border-border/50 px-3 py-1.5 transition-colors hover:bg-muted/50 active:bg-muted/60"
          >
            <span className="font-mono text-xs text-muted-foreground">
              {ss58Address ? shortenSS58(ss58Address) : address && formatAddress(address)}
            </span>
            {copied ? (
              <Check className="h-3 w-3 text-success flex-shrink-0" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            )}
          </button>
          {isPolkadot && (
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="flex-shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              {showTooltip && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-64 p-2.5 rounded-lg bg-foreground text-background text-[11px] leading-relaxed shadow-lg">
                  <p className="font-medium mb-1">Polkadot Hub uses two address formats</p>
                  <p className="opacity-80">
                    <span className="font-mono">SS58</span> — for receiving DOT/USDC from exchanges and Substrate wallets.
                  </p>
                  <p className="opacity-80 mt-1">
                    <span className="font-mono">EVM</span> ({address && formatAddress(address)}) — same account, used by your wallet internally.
                  </p>
                </div>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
