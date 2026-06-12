import { useMemo } from 'react'
import { formatUSDC } from '../../types/subscriptions'
import { usePolicies, useWallet, useChain, useMetadataBatch } from '../../hooks'
import { ArrowUpRight, Calendar, CreditCard, Wallet, Copy, Check, Send } from 'lucide-react'
import { StatsBar, type StatsBarItem } from './StatsBar'

/* ── Mobile: hero balance + metric row + quick actions ── */
interface MobileHeroProps {
  balance: string | null
  formatBal: (b: string | null) => string
  address?: string
  copied: boolean
  onCopy: () => void
  onSend: () => void
  activePoliciesCount: number
  monthlySpend: bigint
  nextChargeTime: string
}

function MobileHeroStats({ balance, formatBal, address, copied, onCopy, onSend, activePoliciesCount, monthlySpend, nextChargeTime }: MobileHeroProps) {
  const { chainConfig } = useChain()
  const formatAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`

  return (
    <div className="mobile-hero-stats lg:hidden flex-shrink-0">
      {/* Hero balance */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 py-5 shadow-lg shadow-slate-900/20">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/8 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />
        {/* Subtle grid texture */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />

        <div className="relative">
          {/* Top row: label + action buttons */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest" style={{ fontFamily: "'DM Sans', sans-serif" }}>Available Balance</span>

            {/* Quick actions cluster */}
            <div className="flex items-center gap-1.5">
              {address && (
                <button
                  onClick={onCopy}
                  className="flex items-center gap-1.5 rounded-lg bg-white/[0.07] border border-white/[0.08] px-2.5 py-1.5 transition-all duration-150 active:scale-95 hover:bg-white/[0.10]"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <>
                      <span className="font-mono text-[10px] text-slate-400">{formatAddr(address)}</span>
                      <Copy className="h-2.5 w-2.5 text-slate-500" />
                    </>
                  )}
                </button>
              )}
              <button
                onClick={onSend}
                className="flex items-center gap-1.5 rounded-lg bg-blue-500/20 border border-blue-500/20 px-2.5 py-1.5 transition-all duration-150 active:scale-95 hover:bg-blue-500/30"
              >
                <Send className="h-3 w-3 text-blue-400" />
                <span className="text-[10px] font-semibold text-blue-300" style={{ fontFamily: "'DM Sans', sans-serif" }}>Send</span>
              </button>
            </div>
          </div>

          <p className="text-[32px] font-bold text-white tracking-tight leading-none tabular-nums" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {formatBal(balance)}
          </p>
          <p className="text-[11px] text-slate-500 font-medium mt-1.5 tracking-wide">USDC on {chainConfig.shortName}</p>
        </div>

        {/* Metric row inside hero */}
        <div className="relative flex items-stretch gap-0 mt-5 rounded-xl bg-white/[0.06] border border-white/[0.06]">
          <div className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5">
            <span className="text-[13px] font-bold text-rose-400 tabular-nums" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {(Number(monthlySpend) / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">Monthly</span>
          </div>
          <div className="w-px bg-white/[0.06] my-2" />
          <div className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5">
            <span className="text-[13px] font-bold text-emerald-400 tabular-nums" style={{ fontFamily: "'DM Sans', sans-serif" }}>{activePoliciesCount}</span>
            <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">Active</span>
          </div>
          <div className="w-px bg-white/[0.06] my-2" />
          <div className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5">
            <span className="text-[13px] font-bold text-amber-400 tabular-nums" style={{ fontFamily: "'DM Sans', sans-serif" }}>{nextChargeTime}</span>
            <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">Next</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface StatsOverviewProps {
  address?: string
  copied?: boolean
  onCopy?: () => void
  onSend?: () => void
}

export function StatsOverview({ address, copied = false, onCopy, onSend }: StatsOverviewProps = {}) {
  const { balance } = useWallet()
  const { policies } = usePolicies()

  // Fetch metadata for policies that have a metadataUrl
  const metadataUrls = useMemo(() => policies.map(p => p.metadataUrl || null), [policies])
  const metadataMap = useMetadataBatch(metadataUrls)

  const formatBalance = (bal: string | null) => {
    if (bal === null) return '$0.00'
    const value = parseFloat(bal)
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    })
  }

  const formatBalanceShort = (bal: string | null) => {
    if (bal === null) return '$0.00'
    const value = parseFloat(bal)
    return '$' + value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  // Calculate stats from real policies
  const activePolicies = policies.filter(p => p.active)
  const activePoliciesCount = activePolicies.length

  // Calculate monthly spend (sum of all active policy charge amounts)
  // This is an approximation - assumes monthly billing
  const monthlySpend = activePolicies.reduce((sum, p) => {
    // Convert interval to monthly equivalent
    const monthlyMultiplier = (30 * 24 * 60 * 60) / p.interval
    return sum + BigInt(Math.floor(Number(p.chargeAmount) * monthlyMultiplier))
  }, 0n)

  // Find the next charge time (fast-forward past stale data)
  const now = Math.floor(Date.now() / 1000)
  const nextPolicy = activePolicies
    .map(p => {
      const raw = p.lastCharged + p.interval
      let nextCharge = raw
      if (nextCharge <= now) {
        const elapsed = now - p.lastCharged
        const periods = Math.ceil(elapsed / p.interval)
        nextCharge = p.lastCharged + periods * p.interval
      }
      return { policy: p, nextCharge }
    })
    .sort((a, b) => a.nextCharge - b.nextCharge)[0]

  const getNextChargeTime = (): string => {
    if (!nextPolicy) return '—'
    const diff = nextPolicy.nextCharge - now
    const days = Math.floor(diff / 86400)
    const hours = Math.floor((diff % 86400) / 3600)
    const mins = Math.floor((diff % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${mins}m`
    if (mins > 0) return `~${mins}m`
    return '<1m'
  }

  const nextChargeTime = getNextChargeTime()
  const nextPolicyMetadata = nextPolicy?.policy.metadataUrl
    ? metadataMap.get(nextPolicy.policy.metadataUrl)
    : null
  const nextMerchant = nextPolicy
    ? (nextPolicyMetadata?.merchant?.name || `${nextPolicy.policy.merchant.slice(0, 6)}...`)
    : 'No active subs'

  return (
    <>
      {/* ── Mobile: hero balance card ── */}
      <MobileHeroStats
        balance={balance}
        formatBal={formatBalanceShort}
        address={address}
        copied={copied}
        onCopy={onCopy || (() => {})}
        onSend={onSend || (() => {})}
        activePoliciesCount={activePoliciesCount}
        monthlySpend={monthlySpend}
        nextChargeTime={nextChargeTime}
      />

      {/* ── Desktop: slashed unibar ── */}
      <div className="hidden lg:block flex-shrink-0">
        <StatsBar stats={buildSubscriberStats({
          balance: formatBalance(balance),
          monthlySpend: formatUSDC(monthlySpend),
          activePoliciesCount,
          nextChargeTime,
          nextMerchant,
        })} />
      </div>
    </>
  )
}

function buildSubscriberStats(args: {
  balance: string
  monthlySpend: string
  activePoliciesCount: number
  nextChargeTime: string
  nextMerchant: string
}): StatsBarItem[] {
  const hasNext = args.nextChargeTime !== '—'
  return [
    {
      label: 'Wallet Balance',
      value: (
        <>
          {args.balance}
          <span className="ml-1.5 text-sm font-semibold tracking-wider opacity-70">USDC</span>
        </>
      ),
      sub: 'Available now',
      color: 'c1',
      icon: <Wallet className="h-[16px] w-[16px]" strokeWidth={2} />,
    },
    {
      label: 'Monthly Outgoing',
      value: args.monthlySpend,
      sub: 'Total across all subs',
      color: 'c2',
      icon: <ArrowUpRight className="h-[16px] w-[16px]" strokeWidth={2} />,
    },
    {
      label: 'Subscriptions',
      value: args.activePoliciesCount.toString(),
      sub: 'Active',
      color: 'c3',
      icon: <CreditCard className="h-[16px] w-[16px]" strokeWidth={2} />,
    },
    {
      label: 'Next Payment',
      value: hasNext ? args.nextChargeTime : (
        <span className="opacity-40 font-semibold">—</span>
      ),
      sub: args.nextMerchant,
      color: 'c4',
      icon: <Calendar className="h-[16px] w-[16px]" strokeWidth={2} />,
    },
  ]
}
