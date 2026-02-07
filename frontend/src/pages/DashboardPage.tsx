import * as React from 'react'
import { StatsOverview } from '../components/dashboard'
import { SubscriptionsList } from '../components/subscriptions'
import { ActivityList } from '../components/activity'
import { SendUSDC } from '../components/wallet/SendUSDC'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '../components/ui/drawer'
import { ArrowRight, CreditCard, Activity, ChevronRight, Clock, Send, Loader2, ArrowDownUp } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useWallet, usePolicies, useMetadataBatch } from '../hooks'
import { formatUSDC } from '../types/subscriptions'

interface DashboardPageProps {
  onNavigate: (page: 'subscriptions' | 'activity' | 'bridge') => void
}

// Generate color theme based on merchant address
function getMerchantGradient(address: string) {
  const gradients = [
    'from-blue-500 to-indigo-500',
    'from-emerald-500 to-teal-500',
    'from-violet-500 to-purple-500',
    'from-orange-500 to-amber-500',
    'from-pink-500 to-rose-500',
    'from-cyan-500 to-blue-500',
  ]
  const index = parseInt(address.slice(-2), 16) % gradients.length
  return gradients[index]
}

function getNextChargeTimestamp(lastCharged: number, interval: number): number {
  const next = lastCharged + interval
  const now = Math.floor(Date.now() / 1000)
  if (next > now) return next
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

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h`
  return 'Soon'
}

/* ── Mobile: horizontally scrollable subscription chips ── */
function MobileSubscriptionScroll({ onNavigate }: { onNavigate: () => void }) {
  const { policies, isLoading } = usePolicies()
  const metadataUrls = React.useMemo(() => policies.map(p => p.metadataUrl || null), [policies])
  const metadataMap = useMetadataBatch(metadataUrls)
  const activePolicies = policies.filter(p => p.active)

  if (isLoading && policies.length === 0) {
    return (
      <div className="md:hidden">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (activePolicies.length === 0) {
    return (
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <h3 className="text-[13px] font-semibold text-foreground/80" style={{ fontFamily: "'DM Sans', sans-serif" }}>Subscriptions</h3>
          <button
            onClick={onNavigate}
            className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            See all
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="text-center py-4 text-xs text-muted-foreground">
          No active subscriptions
        </div>
      </div>
    )
  }

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <h3 className="text-[13px] font-semibold text-foreground/80" style={{ fontFamily: "'DM Sans', sans-serif" }}>Subscriptions</h3>
        <button
          onClick={onNavigate}
          className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          See all
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      <div className="relative -mx-3">
        <div className="flex gap-2.5 overflow-x-auto pb-1 px-3 scrollbar-hide">
          {activePolicies.map(policy => {
            const nextChargeTime = getNextChargeTimestamp(policy.lastCharged, policy.interval)
            const meta = policy.metadataUrl ? metadataMap.get(policy.metadataUrl) : undefined
            const displayName = meta?.merchant?.name || meta?.plan?.name || `${policy.merchant.slice(0, 6)}...${policy.merchant.slice(-4)}`
            const avatarLetters = meta?.merchant?.name
              ? meta.merchant.name.slice(0, 2).toUpperCase()
              : policy.merchant.slice(2, 4).toUpperCase()
            return (
              <button
                key={policy.policyId}
                onClick={onNavigate}
                className="flex-shrink-0 flex items-center gap-2.5 rounded-xl bg-card border border-border/50 pl-2.5 pr-3.5 py-2.5 shadow-sm active:scale-[0.97] transition-all duration-150 hover:shadow-md"
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${getMerchantGradient(policy.merchant)} text-white text-[11px] font-bold shadow-sm`}>
                  {avatarLetters}
                </div>
                <div className="text-left">
                  <p className="text-[12px] font-semibold text-foreground leading-tight">
                    {displayName}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{formatUSDC(policy.chargeAmount)}</span>
                    <span className="text-muted-foreground/30">&middot;</span>
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
                      <Clock className="h-2.5 w-2.5" />
                      {getRemainingTime(nextChargeTime)}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        {/* Right fade hint for more content */}
        <div className="absolute top-0 right-0 bottom-1 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none" />
      </div>
    </div>
  )
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { account } = useWallet()
  const [copied, setCopied] = React.useState(false)
  const [sendOpen, setSendOpen] = React.useState(false)

  const handleCopy = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex flex-col gap-3 md:h-full md:gap-6">
      {/* Stats Overview — hero card includes address + send on mobile */}
      <StatsOverview
        address={account?.address}
        copied={copied}
        onCopy={handleCopy}
        onSend={() => setSendOpen(true)}
      />

      {/* ── Mobile: Send USDC bottom drawer ── */}
      <Drawer open={sendOpen} onOpenChange={setSendOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left pb-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/10">
                <Send className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <DrawerTitle className="text-[15px]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Send USDC</DrawerTitle>
                <DrawerDescription className="text-[12px]">Transfer gaslessly via your smart wallet</DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="px-4 pb-8">
            <SendUSDC inline />
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Mobile layout ── */}
      <div className="flex flex-col gap-4 md:hidden">
        {/* Subscription chips — horizontal scroll */}
        <MobileSubscriptionScroll onNavigate={() => onNavigate('subscriptions')} />

        {/* Bridge Funds Quick Action */}
        <button
          onClick={() => onNavigate('bridge')}
          className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl border border-blue-500/20 active:scale-[0.98] transition-all"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/20">
            <ArrowDownUp className="h-5 w-5" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[13px] font-semibold">Bridge Funds</p>
            <p className="text-[11px] text-muted-foreground">Transfer USDC from other chains</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Recent Activity */}
        <div>
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50">
                  <Activity className="h-3.5 w-3.5 text-purple-500" />
                </div>
                <CardTitle className="text-[13px] font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>Recent Activity</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('activity')}
                className="text-muted-foreground h-7 text-[11px] hover:text-primary gap-0.5 group/btn flex-shrink-0 px-2"
              >
                View all
                <ArrowRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-0.5" />
              </Button>
            </CardHeader>
            <CardContent className="p-0 border-t border-border/40">
              <ActivityList limit={5} compact />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Desktop: original grid layout ── */}
      <div className="hidden md:grid flex-1 gap-6 lg:grid-cols-3 min-h-0">
        {/* Left column - Subscriptions */}
        <div className="flex flex-col lg:col-span-2 min-h-0 overflow-hidden">
          <Card className="flex flex-col min-h-0 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between py-3.5 px-5 flex-shrink-0 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
                  <CreditCard className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-[15px] font-semibold">Active Subscriptions</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('subscriptions')}
                className="text-muted-foreground h-8 text-xs hover:text-primary gap-1.5 group/btn flex-shrink-0 px-3"
              >
                View all
                <ArrowRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-0.5" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-5">
              <SubscriptionsList compact />
            </CardContent>
          </Card>
        </div>

        {/* Right column - Quick Actions & Activity */}
        <div className="flex flex-col gap-6 min-h-0 overflow-hidden">
          <SendUSDC compact />

          {/* Bridge Funds Quick Action */}
          <button
            onClick={() => onNavigate('bridge')}
            className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl border border-blue-500/20 hover:border-blue-500/40 transition-all group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/20">
              <ArrowDownUp className="h-5 w-5" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold">Bridge Funds</p>
              <p className="text-xs text-muted-foreground">Transfer USDC from other chains</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </button>

          <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between py-3.5 px-5 flex-shrink-0 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-100 to-purple-50">
                  <Activity className="h-4 w-4 text-purple-600" />
                </div>
                <CardTitle className="text-[15px] font-semibold">Recent Activity</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('activity')}
                className="text-muted-foreground h-8 text-xs hover:text-primary gap-1.5 group/btn flex-shrink-0 px-3"
              >
                View all
                <ArrowRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-0.5" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <ActivityList limit={5} compact />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
