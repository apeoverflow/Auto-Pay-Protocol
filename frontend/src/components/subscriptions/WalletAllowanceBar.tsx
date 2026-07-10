import * as React from 'react'
import { Loader2, Infinity as InfinityIcon, Pencil, Check, AlertTriangle, HelpCircle } from 'lucide-react'
import { maxUint128, maxUint256, parseUnits } from 'viem'
import { useApproval, useChain, usePolicies } from '../../hooks'
import { formatUSDC } from '../../types/subscriptions'
import { USDC_DECIMALS, UNLIMITED_APPROVAL_THRESHOLD } from '../../config'
import { isTempoBuild } from '../../contexts/TempoWalletContext'

const SECONDS_PER_YEAR = 31_536_000n

/**
 * Dashboard bar: current wallet approval, aggregate 12-month projected spend,
 * a coverage meter comparing the two, and an inline editor. Matches the visual
 * language of the StatsOverview cards (thin gradient accent, tinted icon,
 * uppercase eyebrow label, prominent numeric).
 */
export function WalletAllowanceBar() {
  const { chainConfig } = useChain()
  const { policies } = usePolicies()
  const { allowance, allowanceLoaded, approve, isLoading: isApproving, error: approveError } = useApproval(chainConfig.policyManager)
  const isTempo = isTempoBuild()

  const [editing, setEditing] = React.useState(false)
  const [input, setInput] = React.useState('')
  const [editError, setEditError] = React.useState<string | null>(null)

  const activePolicies = policies.filter((p) => p.active)
  const isUnlimited = allowance >= UNLIMITED_APPROVAL_THRESHOLD

  const projectedAnnual = React.useMemo(() => {
    let sum = 0n
    for (const p of activePolicies) {
      if (p.interval <= 0) continue
      sum += p.chargeAmount * (SECONDS_PER_YEAR / BigInt(p.interval))
    }
    return sum
  }, [activePolicies])

  const parsedInput = (() => {
    if (!input) return null
    const val = parseFloat(input)
    if (isNaN(val) || val < 0) return null
    return parseUnits(val.toFixed(USDC_DECIMALS), USDC_DECIMALS)
  })()

  const closeEditor = () => {
    setEditing(false)
    setInput('')
    setEditError(null)
  }

  const setApprovalTo = async (newAmount: bigint) => {
    try {
      await approve(newAmount)
      closeEditor()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Approval failed')
    }
  }

  const handleSetUnlimited = () => {
    setEditError(null)
    setApprovalTo(chainConfig.chain.id === 420420419 ? maxUint128 : maxUint256)
  }

  const handleSave = () => {
    if (parsedInput === null) { setEditError('Enter a valid amount'); return }
    if (parsedInput === 0n) { setEditError('Enter an amount greater than zero'); return }
    if (parsedInput < projectedAnnual && editError === null) {
      setEditError(`Below the ${formatUSDC(projectedAnnual)} projected for the next 12 months — some charges may fail. Click Save again to confirm.`)
      return
    }
    setApprovalTo(parsedInput)
  }

  const isUnderProjection = allowanceLoaded && !isUnlimited && allowance < projectedAnnual
  const hasProjection = projectedAnnual > 0n

  // Coverage % of the 12-month projection covered by the current allowance.
  // Unlimited → 100. Zero projection → hidden (nothing to cover).
  const coveragePct = (() => {
    if (!hasProjection) return null
    if (isUnlimited) return 100
    if (allowance === 0n) return 0
    const pct = Number((allowance * 10_000n) / projectedAnnual) / 100
    return Math.min(100, Math.max(0, pct))
  })()

  const statusPill = (() => {
    if (!allowanceLoaded) return null
    if (isUnlimited) {
      return { label: 'Unlimited', tone: 'indigo' as const, Icon: InfinityIcon }
    }
    if (!hasProjection) return null
    if (isUnderProjection) {
      return { label: 'Under-covered', tone: 'amber' as const, Icon: AlertTriangle }
    }
    return { label: 'Covered', tone: 'emerald' as const, Icon: Check }
  })()

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="px-4 sm:px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex items-center gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Wallet approval
            </p>
            <span className="group relative inline-flex items-center" tabIndex={0}>
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
              <span className="pointer-events-none absolute left-0 top-full mt-1.5 w-64 rounded-md bg-foreground text-background text-[11px] leading-snug px-2 py-1.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity z-10 shadow-md">
                The total USDC the AutoPay contract can pull from your wallet across all subscriptions. Compared here to your projected 12-month charge total so you can tell if you're covered.
              </span>
            </span>
          </span>
          <span className="text-base font-bold tabular-nums" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {!allowanceLoaded ? '—' : isUnlimited ? '∞' : formatUSDC(allowance)}
          </span>
          <span className="text-[12px] text-muted-foreground">
            {isUnlimited ? 'unlimited USDC approval' : 'USDC remaining'}
          </span>

          {statusPill && (
            <span
              className={
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                (statusPill.tone === 'indigo'
                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                  : statusPill.tone === 'emerald'
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  : 'bg-amber-50 text-amber-700 border border-amber-100')
              }
            >
              <statusPill.Icon className="h-2.5 w-2.5" />
              {statusPill.label}
            </span>
          )}

          <span className="text-muted-foreground/40">·</span>

          {hasProjection ? (
            <span className={`text-[12px] tabular-nums ${isUnderProjection ? 'text-amber-600' : 'text-muted-foreground'}`}>
              {coveragePct !== null && !isUnlimited && <>Covers {coveragePct.toFixed(0)}% of </>}
              {formatUSDC(projectedAnnual)} projected next 12 months
            </span>
          ) : (
            <span className="text-[12px] text-muted-foreground">
              No active subscriptions yet — nothing to charge.
            </span>
          )}

          {!isTempo && (
            <button
              onClick={() => setEditing((v) => !v)}
              className="ml-auto inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-border bg-background text-[13px] font-medium hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Pencil className="h-3 w-3" />
              {editing ? 'Close' : 'Update approval'}
            </button>
          )}
        </div>

        {editing && !isTempo && (
          <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Set the new total USDC authorization. This replaces your current allowance with the exact amount you enter.
            </p>
            <div className="flex flex-wrap gap-1.5 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={hasProjection ? `Suggested: ${formatUSDC(projectedAnnual)}` : 'Amount in USDC'}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setEditError(null) }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  className="w-full h-9 pl-6 pr-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={!input || isApproving}
                className="inline-flex items-center gap-1 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {isApproving && <Loader2 className="h-3 w-3 animate-spin" />}
                Save
              </button>
              <button
                onClick={handleSetUnlimited}
                disabled={isApproving}
                className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50"
              >
                <InfinityIcon className="h-3 w-3" />
                Unlimited
              </button>
            </div>
            {editError && <p className="text-[11px] text-amber-600">{editError}</p>}
            {approveError && <p className="text-[11px] text-red-500">{approveError}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
