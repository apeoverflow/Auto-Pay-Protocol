import { Zap } from 'lucide-react'
import { CHAIN_CONFIGS, DEFAULT_CHAIN } from '../../config/chains'
import type { CheckoutMetadata } from '../../types/checkout'
import { formatIntervalLabel } from '../../lib/utils'
import { PlanPreviewCard } from '../shared/PlanPreviewCard'

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

  // Pre-resolve the logo so PlanPreviewCard gets an absolute URL
  const resolvedLogoUrl = merchant.logo ? resolveLogoUrl(merchant.logo, metadataUrl) : undefined

  return (
    <div>
      <PlanPreviewCard
        plan={plan}
        merchant={{ ...merchant, logo: resolvedLogoUrl }}
        amount={amount}
        interval={interval}
        display={display}
      />

      {/* Billing details */}
      <div className="rounded-lg bg-muted/50 px-4 py-3 mb-6 mt-4 text-xs text-muted-foreground space-y-1">
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
          <span className="font-medium text-foreground">{CHAIN_CONFIGS[DEFAULT_CHAIN].name}</span>
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
