import * as React from 'react'
import { Shield, Loader2, AlertCircle, ChevronDown } from 'lucide-react'
import { parseUnits } from 'viem'
import { useWallet } from '../../hooks'
import { USDC_DECIMALS } from '../../config'
import { formatUSDC } from '../../types/subscriptions'

/** Extract a short user-friendly message from a verbose error string */
function friendlyError(raw: string): { summary: string; details: string | null } {
  if (raw.includes('User rejected') || raw.includes('User denied')) {
    return { summary: 'Transaction rejected — please try again.', details: raw }
  }
  if (raw.includes('insufficient funds')) {
    return { summary: 'Insufficient funds for gas fees.', details: raw }
  }
  // If the raw message is short enough, show it directly
  if (raw.length <= 120) {
    return { summary: raw, details: null }
  }
  // Otherwise, take the first sentence or 120 chars
  const firstSentence = raw.split(/\.\s/)[0]
  const summary = firstSentence.length <= 120 ? firstSentence + '.' : raw.slice(0, 120) + '...'
  return { summary, details: raw }
}

function ErrorBanner({ summary, details }: { summary: string; details: string | null }) {
  const [showDetails, setShowDetails] = React.useState(false)
  return (
    <div className="p-3 rounded-lg bg-red-50 border border-red-100 mb-4">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-red-600">{summary}</p>
          {details && (
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="mt-1 text-[11px] text-red-400 hover:text-red-500 flex items-center gap-0.5"
            >
              {showDetails ? 'Hide' : 'Show'} details
              <ChevronDown className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            </button>
          )}
          {showDetails && details && (
            <pre className="mt-2 text-[10px] text-red-500/80 whitespace-pre-wrap break-all max-h-24 overflow-y-auto bg-red-50 rounded p-2 border border-red-100">
              {details}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

type ApprovalMode = 'year' | 'unlimited' | 'custom'

interface WalletSetupStepProps {
  cancelUrl: string
  /** Per-charge amount in 6-decimal USDC — the contract's minimum approval. */
  chargeAmount: bigint
  /** Lifetime cap chosen for this subscription (null = unlimited). */
  capAmount: bigint | null
  /** Current USDC allowance already granted to the AutoPay contract. */
  currentAllowance: bigint
  /** True when the current allowance is the unlimited sentinel. */
  isUnlimitedAllowance: boolean
  /** 12-month projected spend across the payer's existing active subscriptions. */
  projectedAnnualExisting: bigint
  /** 12-month projected spend for the subscription being created. */
  projectedAnnualNew: bigint
  /** Any existing active sub is uncapped → year-coverage chip can't truly bound it. */
  hasUnlimitedExistingSub?: boolean
  /** Tempo always grants unlimited server-side; lock the UI accordingly. */
  isTempo?: boolean
  /** Called after a successful approval transaction so the parent can advance. */
  onApproved?: () => void
}

export function WalletSetupStep({
  cancelUrl,
  chargeAmount,
  capAmount,
  currentAllowance,
  isUnlimitedAllowance,
  projectedAnnualExisting,
  projectedAnnualNew,
  hasUnlimitedExistingSub,
  isTempo,
  onApproved,
}: WalletSetupStepProps) {
  const { setupWallet, isSettingUp, setupStatus, setupError } = useWallet()

  // Default to Unlimited — covers existing commitments + this new sub without
  // having to do projection math, and means the user won't be routed back here
  // on their next subscription. The "12 months" chip is the finite alternative.
  const [mode, setMode] = React.useState<ApprovalMode>('unlimited')
  const [customInput, setCustomInput] = React.useState('')
  const [customError, setCustomError] = React.useState<string | null>(null)

  // Aggregate 12-month projection across all current commitments + the new sub.
  // This is the *absolute* allowance the "12 months" chip will set — the
  // projection already accounts for existing subs, so no need to add `allowance`.
  const projectedAnnualTotal = projectedAnnualExisting + projectedAnnualNew
  // Hide the year chip if there's nothing to cover or any existing sub is
  // uncapped (we can't honestly project an unbounded sub's annual spend).
  const yearChipAvailable =
    !hasUnlimitedExistingSub && capAmount !== null && projectedAnnualTotal > 0n

  // Resolve the chosen approval amount in 6-decimal USDC (undefined = unlimited).
  const customAmount = React.useMemo(() => {
    if (!customInput) return null
    const val = parseFloat(customInput)
    if (isNaN(val) || val < 0) return null
    return parseUnits(val.toFixed(USDC_DECIMALS), USDC_DECIMALS)
  }, [customInput])

  // Resolve the absolute allowance the approval tx will set.
  // - Year: absolute total projected across all active subs + this new one.
  // - Custom: absolute (user is explicitly setting the wallet's allowance).
  // - Unlimited: undefined → setupWallet picks the unlimited sentinel.
  const chosenAmount: bigint | undefined = (() => {
    if (mode === 'unlimited') return undefined
    if (mode === 'year') return yearChipAvailable ? projectedAnnualTotal : undefined
    return customAmount ?? undefined
  })()

  const handleSetup = async () => {
    setCustomError(null)
    // Tempo: server-side relayer always approves max; ignore the chosen amount.
    if (isTempo) {
      try { await setupWallet(); onApproved?.() } catch { /* via setupError */ }
      return
    }
    if (mode === 'custom') {
      if (customAmount === null) { setCustomError('Enter a valid amount'); return }
      if (customAmount < chargeAmount) {
        setCustomError(`Must be at least ${formatUSDC(chargeAmount)} (one charge), or pick Unlimited.`)
        return
      }
    }
    try {
      await setupWallet(chosenAmount)
      onApproved?.()
    } catch {
      // Error is displayed via setupError state
    }
  }

  const chargeLabel = formatUSDC(chargeAmount)
  const yearLabel = formatUSDC(projectedAnnualTotal)
  const existingYearLabel = formatUSDC(projectedAnnualExisting)
  const newYearLabel = formatUSDC(projectedAnnualNew)
  const hasExistingCommitments = projectedAnnualExisting > 0n
  const customBelowNewYear = mode === 'custom' && customAmount !== null && projectedAnnualNew > 0n && customAmount < projectedAnnualNew

  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Shield className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Authorize USDC</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isTempo
            ? 'Authorize the AutoPay contract to manage your subscriptions'
            : 'Choose how much USDC the contract is allowed to charge'}
        </p>
      </div>

      {/* Current allowance summary — so the user can see what they already have */}
      {!isTempo && currentAllowance > 0n && (
        <div className="mb-4 flex justify-between items-center text-xs rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="text-muted-foreground">Current approval</span>
          <span className="font-medium">
            {isUnlimitedAllowance ? 'Unlimited' : `${formatUSDC(currentAllowance)} USDC remaining`}
          </span>
        </div>
      )}

      {/* Amount picker (hidden on Tempo — that path is unlimited only) */}
      {!isTempo && (
        <div className="mb-5 space-y-2">
          {mode === 'year' && yearChipAvailable && (
            <p className="text-[11px] text-muted-foreground">
              {hasExistingCommitments
                ? <>Covers <strong className="text-foreground">{existingYearLabel}</strong> across your existing subscriptions + <strong className="text-foreground">{newYearLabel}</strong> for this one over the next 12 months → <strong className="text-foreground">{yearLabel}</strong> total.</>
                : <>Covers <strong className="text-foreground">{yearLabel}</strong> of charges over the next 12 months for this subscription.</>
              }
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => { setMode('unlimited'); setCustomError(null) }}
              className={`text-[12px] px-3 py-1.5 rounded-md border transition-colors ${
                mode === 'unlimited'
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
              }`}
            >
              Unlimited
            </button>
            {yearChipAvailable && (
              <button
                type="button"
                onClick={() => { setMode('year'); setCustomError(null) }}
                className={`text-[12px] px-3 py-1.5 rounded-md border transition-colors ${
                  mode === 'year'
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                }`}
              >
                12 months ({yearLabel})
              </button>
            )}
            <button
              type="button"
              onClick={() => { setMode('custom'); setCustomError(null) }}
              className={`text-[12px] px-3 py-1.5 rounded-md border transition-colors ${
                mode === 'custom'
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
              }`}
            >
              Custom
            </button>
          </div>

          {hasUnlimitedExistingSub && mode !== 'unlimited' && (
            <p className="text-[11px] text-amber-600">
              One of your existing subscriptions has no cap, so a finite approval can't safely cover it long-term — pick Unlimited to cover it.
            </p>
          )}

          {mode === 'custom' && (
            <div className="space-y-1">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                <input
                  type="number"
                  step="0.01"
                  min={Number(chargeAmount) / 10 ** USDC_DECIMALS}
                  placeholder={`Amount in USDC (min ${chargeLabel})`}
                  value={customInput}
                  onChange={(e) => { setCustomInput(e.target.value); setCustomError(null) }}
                  className="w-full h-9 pl-6 pr-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {customError && <p className="text-[11px] text-red-500">{customError}</p>}
              {customBelowNewYear && !customError && (
                <p className="text-[11px] text-amber-600">
                  Below the {newYearLabel} projected for the next 12 months of this subscription — charges will stop once this allowance is exhausted.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg bg-muted/50 px-4 py-3 mb-6 text-xs text-muted-foreground space-y-2">
        <p>This authorizes the AutoPay smart contract to charge your USDC according to your subscription terms:</p>
        <ul className="list-disc pl-4 space-y-1">
          {chosenAmount === undefined ? (
            <li>Subscriptions can charge any amount up to each plan's spending cap and your balance</li>
          ) : (
            <li>Approval is capped at {formatUSDC(chosenAmount)} USDC — the contract can never pull more</li>
          )}
          <li>You can adjust or revoke this from your dashboard at any time</li>
        </ul>
      </div>

      {setupError && (() => {
        const { summary, details } = friendlyError(setupError)
        return <ErrorBanner summary={summary} details={details} />
      })()}

      <button
        onClick={handleSetup}
        disabled={isSettingUp}
        className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isSettingUp ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {setupStatus}
          </>
        ) : (
          <>
            <Shield className="w-4 h-4" />
            Approve USDC
          </>
        )}
      </button>

      {!isTempo && currentAllowance > 0n && (
        <button
          type="button"
          onClick={() => onApproved?.()}
          disabled={isSettingUp}
          className="w-full mt-2 h-11 rounded-xl border border-border bg-background text-sm font-medium text-foreground hover:border-foreground/40 hover:bg-muted/40 transition-colors disabled:opacity-50"
        >
          Continue with current approval ({isUnlimitedAllowance ? 'Unlimited' : `${formatUSDC(currentAllowance)} USDC`})
        </button>
      )}

      <div className="text-center mt-3">
        <a href={cancelUrl} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </a>
      </div>
    </div>
  )
}
