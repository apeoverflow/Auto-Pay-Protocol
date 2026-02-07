import * as React from 'react'
import { Check, Zap } from 'lucide-react'
import type { CheckoutMetadata } from '../../types/checkout'
import { formatUSDCString, formatIntervalLabel } from '../../lib/utils'

interface PlanSummaryProps {
  metadata: CheckoutMetadata
  metadataUrl: string
  amount: string
  interval: number
  onContinue: () => void
  cancelUrl: string
}

/** Resolve a logo path — if relative (e.g. "/logos/foo.png"), resolve against the metadata URL's origin */
function resolveLogoUrl(logo: string, metadataUrl: string): string {
  if (logo.startsWith('http')) return logo
  try {
    const base = new URL(metadataUrl)
    return `${base.origin}${logo.startsWith('/') ? '' : '/'}${logo}`
  } catch {
    return logo
  }
}

export function PlanSummary({ metadata, metadataUrl, amount, interval, onContinue, cancelUrl }: PlanSummaryProps) {
  const { plan, merchant, display } = metadata
  const accentColor = display?.color || '#6366F1'
  const [logoError, setLogoError] = React.useState(false)

  const logoUrl = merchant.logo && !logoError
    ? resolveLogoUrl(merchant.logo, metadataUrl)
    : null

  return (
    <div>
      {/* Merchant header */}
      <div className="text-center mb-6">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={merchant.name}
            onError={() => setLogoError(true)}
            className="w-12 h-12 rounded-xl mx-auto mb-3 object-cover"
          />
        ) : (
          <div
            className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center text-white font-bold text-lg"
            style={{ background: accentColor }}
          >
            {merchant.name.charAt(0)}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{merchant.name}</p>
      </div>

      {/* Plan card */}
      <div className="rounded-xl border border-border bg-card p-5 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">{plan.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
          </div>
          {display?.badge && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ background: accentColor }}
            >
              {display.badge}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1.5 mb-4">
          <span className="text-3xl font-bold">${formatUSDCString(amount)}</span>
          <span className="text-sm text-muted-foreground">
            USDC / {formatIntervalLabel(interval)}
          </span>
        </div>

        {/* Features */}
        {plan.features && plan.features.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-border">
            {plan.features.map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Billing details */}
      <div className="rounded-lg bg-muted/50 px-4 py-3 mb-6 text-xs text-muted-foreground space-y-1">
        <div className="flex justify-between">
          <span>Billing cycle</span>
          <span className="font-medium text-foreground">Every {formatIntervalLabel(interval)}</span>
        </div>
        <div className="flex justify-between">
          <span>First charge</span>
          <span className="font-medium text-foreground">Now</span>
        </div>
        <div className="flex justify-between">
          <span>Network</span>
          <span className="font-medium text-foreground">Arc Testnet</span>
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={onContinue}
        className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
      >
        <Zap className="w-4 h-4" />
        Continue to pay
      </button>

      <div className="text-center mt-3">
        <a
          href={cancelUrl}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </a>
      </div>
    </div>
  )
}
