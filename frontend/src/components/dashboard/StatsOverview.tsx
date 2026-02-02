import { formatUSDC, getRemainingTime } from '../../types/subscriptions'
import { mockStats, mockSubscriptions } from '../../mocks/data'
import { ArrowUpRight, Calendar, CreditCard, Wallet, Copy, Check, Send } from 'lucide-react'
import { useWallet } from '../../hooks'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  gradientFrom: string
  gradientTo: string
  iconBg: string
  iconColor: string
  accentColor: string
}

function StatCard({ title, value, subtitle, icon, gradientFrom, gradientTo, iconBg, iconColor, accentColor }: StatCardProps) {
  return (
    <div className="stat-card group border-border hidden md:block">
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${gradientFrom} ${gradientTo}`} />

      {/* Subtle background gradient */}
      <div className={`absolute inset-0 opacity-[0.02] bg-gradient-to-br ${gradientFrom} ${gradientTo} pointer-events-none`} />

      <div className="relative p-5">
        <div className="space-y-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${iconBg} transition-all duration-300 ${accentColor}`}>
              <div className={iconColor}>{icon}</div>
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          </div>
          <p className="text-[28px] font-bold tracking-tight leading-none truncate">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground/80 font-medium">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Mobile: hero balance + metric row + quick actions ── */
interface MobileHeroProps {
  balance: string | null
  formatBal: (b: string | null) => string
  address?: string
  copied: boolean
  onCopy: () => void
  onSend: () => void
}

function MobileHeroStats({ balance, formatBal, address, copied, onCopy, onSend }: MobileHeroProps) {
  const activeSubscriptions = mockSubscriptions.filter(s => s.status === 'active')
  const nextPayment = activeSubscriptions.length > 0
    ? activeSubscriptions.reduce((earliest, sub) =>
        sub.nextCharge < earliest.nextCharge ? sub : earliest
      )
    : null

  const formatAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`

  return (
    <div className="mobile-hero-stats md:hidden flex-shrink-0">
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
            <div className="flex items-center gap-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20">
                <span className="text-[9px] font-bold text-blue-400">$</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest" style={{ fontFamily: "'DM Sans', sans-serif" }}>Available Balance</span>
            </div>

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
          <p className="text-[11px] text-slate-500 font-medium mt-1.5 tracking-wide">USDC on Polygon</p>
        </div>

        {/* Metric row inside hero */}
        <div className="relative flex items-stretch gap-0 mt-5 rounded-xl bg-white/[0.06] border border-white/[0.06]">
          <div className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5">
            <span className="text-[13px] font-bold text-rose-400 tabular-nums" style={{ fontFamily: "'DM Sans', sans-serif" }}>{formatUSDC(mockStats.totalMonthlySpend)}</span>
            <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">Monthly</span>
          </div>
          <div className="w-px bg-white/[0.06] my-2" />
          <div className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5">
            <span className="text-[13px] font-bold text-emerald-400 tabular-nums" style={{ fontFamily: "'DM Sans', sans-serif" }}>{mockStats.activeSubscriptions}</span>
            <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">Active</span>
          </div>
          <div className="w-px bg-white/[0.06] my-2" />
          <div className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5">
            <span className="text-[13px] font-bold text-amber-400 tabular-nums" style={{ fontFamily: "'DM Sans', sans-serif" }}>{nextPayment ? getRemainingTime(nextPayment.nextCharge) : '—'}</span>
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

  // Find the soonest upcoming charge
  const activeSubscriptions = mockSubscriptions.filter(s => s.status === 'active')
  const nextPayment = activeSubscriptions.length > 0
    ? activeSubscriptions.reduce((earliest, sub) =>
        sub.nextCharge < earliest.nextCharge ? sub : earliest
      )
    : null

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
      />

      {/* ── Desktop: full stat cards ── */}
      <div className="hidden md:grid gap-4 lg:grid-cols-4 flex-shrink-0">
        <StatCard
          title="Wallet Balance"
          value={formatBalance(balance)}
          subtitle="USDC"
          icon={<Wallet className="h-[18px] w-[18px]" />}
          gradientFrom="from-blue-500"
          gradientTo="to-blue-400"
          iconBg="bg-blue-500/15"
          iconColor="text-blue-600"
          accentColor="group-hover:shadow-blue-500/20"
        />
        <StatCard
          title="Monthly Outgoing"
          value={formatUSDC(mockStats.totalMonthlySpend)}
          subtitle="Total across all subs"
          icon={<ArrowUpRight className="h-[18px] w-[18px]" />}
          gradientFrom="from-rose-500"
          gradientTo="to-orange-400"
          iconBg="bg-rose-500/15"
          iconColor="text-rose-600"
          accentColor="group-hover:shadow-rose-500/20"
        />
        <StatCard
          title="Subscriptions"
          value={mockStats.activeSubscriptions.toString()}
          subtitle="Active"
          icon={<CreditCard className="h-[18px] w-[18px]" />}
          gradientFrom="from-emerald-500"
          gradientTo="to-teal-400"
          iconBg="bg-emerald-500/15"
          iconColor="text-emerald-600"
          accentColor="group-hover:shadow-emerald-500/20"
        />
        <StatCard
          title="Next Payment"
          value={nextPayment ? getRemainingTime(nextPayment.nextCharge) : 'None'}
          subtitle={nextPayment ? nextPayment.plan.merchantName : 'No active subs'}
          icon={<Calendar className="h-[18px] w-[18px]" />}
          gradientFrom="from-amber-500"
          gradientTo="to-yellow-400"
          iconBg="bg-amber-500/15"
          iconColor="text-amber-600"
          accentColor="group-hover:shadow-amber-500/20"
        />
      </div>
    </>
  )
}
