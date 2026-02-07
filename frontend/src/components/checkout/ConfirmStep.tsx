import * as React from 'react'
import { CreditCard, Loader2, Shield, ChevronDown, ExternalLink } from 'lucide-react'
import type { CheckoutMetadata } from '../../types/checkout'
import { formatUSDCString, formatIntervalLabel, shortenAddress } from '../../lib/utils'
import { useWallet } from '../../hooks'

interface ConfirmStepProps {
  metadata: CheckoutMetadata
  merchant: `0x${string}`
  amount: string
  interval: number
  spendingCap?: string
  onSpendingCapChange: (cap: string | undefined) => void
  onSubscribe: () => void
  isLoading: boolean
  error: string | null
  cancelUrl: string
}

/** Build spending cap presets based on charge amount */
function buildPresets(chargeAmount: number): { label: string; value: string | undefined }[] {
  return [
    { label: '3 charges', value: (chargeAmount * 3).toFixed(2) },
    { label: '6 charges', value: (chargeAmount * 6).toFixed(2) },
    { label: '12 charges', value: (chargeAmount * 12).toFixed(2) },
    { label: 'Unlimited', value: undefined },
  ]
}

export function ConfirmStep({ metadata, merchant, amount, interval, spendingCap, onSpendingCapChange, onSubscribe, isLoading, error, cancelUrl }: ConfirmStepProps) {
  const { account, balance } = useWallet()
  const merchantName = metadata.merchant.name
  const chargeAmount = parseFloat(amount)
  const presets = React.useMemo(() => buildPresets(chargeAmount), [chargeAmount])

  const [showCapEditor, setShowCapEditor] = React.useState(false)
  const [customInput, setCustomInput] = React.useState('')
  const [customError, setCustomError] = React.useState<string | null>(null)

  const handlePresetSelect = (value: string | undefined) => {
    setCustomInput('')
    setCustomError(null)
    onSpendingCapChange(value)
  }

  const handleCustomApply = () => {
    const val = parseFloat(customInput)
    if (isNaN(val) || val <= 0) {
      setCustomError('Enter a valid amount')
      return
    }
    if (val < chargeAmount) {
      setCustomError(`Must be at least $${formatUSDCString(amount)} (1 charge)`)
      return
    }
    setCustomError(null)
    onSpendingCapChange(val.toFixed(2))
  }

  // Which preset is currently active?
  const activePreset = presets.findIndex((p) => p.value === spendingCap)

  return (
    <div>
      <div className="text-center mb-5">
        <h2 className="text-lg font-semibold">Confirm subscription</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review the details below and subscribe
        </p>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-border bg-card p-4 mb-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Plan</span>
          <span className="font-medium">{metadata.plan.name}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-medium">${formatUSDCString(amount)} USDC</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Frequency</span>
          <span className="font-medium">Every {formatIntervalLabel(interval)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Merchant</span>
          <span className="font-medium font-mono text-xs">{shortenAddress(merchant)}</span>
        </div>
        {account && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Your wallet</span>
            <span className="font-medium font-mono text-xs">{shortenAddress(account.address)}</span>
          </div>
        )}
        {balance && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Balance</span>
            <span className="flex items-center gap-2">
              <span className="font-medium">{parseFloat(balance).toFixed(2)} USDC</span>
              <a
                href="/bridge"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
              >
                Top up
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </span>
          </div>
        )}

        {/* Spending cap row */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            Spending cap
          </span>
          <button
            type="button"
            onClick={() => setShowCapEditor(!showCapEditor)}
            className="flex items-center gap-1 font-medium text-primary hover:underline text-xs"
          >
            {spendingCap ? `$${formatUSDCString(spendingCap)} USDC` : 'Unlimited'}
            <ChevronDown className={`w-3 h-3 transition-transform ${showCapEditor ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Expandable cap editor */}
        {showCapEditor && (
          <div className="pt-2 pb-1 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Set the maximum total amount this subscription can charge. You can cancel anytime.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handlePresetSelect(preset.value)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                    activePreset === i
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                  }`}
                >
                  {preset.value ? `$${formatUSDCString(preset.value)}` : 'Unlimited'}
                  <span className="ml-1 opacity-60">({preset.label})</span>
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 items-center">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                <input
                  type="number"
                  step="0.01"
                  min={chargeAmount}
                  placeholder="Custom amount"
                  value={customInput}
                  onChange={(e) => {
                    setCustomInput(e.target.value)
                    setCustomError(null)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomApply()}
                  className="w-full h-8 pl-6 pr-2 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                type="button"
                onClick={handleCustomApply}
                disabled={!customInput}
                className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                Set
              </button>
            </div>
            {customError && (
              <p className="text-[11px] text-red-500">{customError}</p>
            )}
          </div>
        )}

        <div className="border-t border-border pt-3 flex justify-between text-sm">
          <span className="font-semibold">Due now</span>
          <span className="font-semibold text-primary">${formatUSDCString(amount)} USDC</span>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground text-center mb-4">
        By subscribing, you authorize {merchantName} to charge ${formatUSDCString(amount)} USDC every{' '}
        {formatIntervalLabel(interval)}{spendingCap ? ` up to a $${formatUSDCString(spendingCap)} cap` : ' with no spending cap'}. You can cancel anytime.
      </p>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 mb-4">
          {error}
        </div>
      )}

      <button
        onClick={onSubscribe}
        disabled={isLoading}
        className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating subscription...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            Subscribe &mdash; ${formatUSDCString(amount)}/
            {formatIntervalLabel(interval)}
          </>
        )}
      </button>

      <div className="text-center mt-3">
        <a href={cancelUrl} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </a>
      </div>
    </div>
  )
}
