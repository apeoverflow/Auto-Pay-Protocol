import * as React from 'react'
import { Check } from 'lucide-react'
import { formatUSDCString, formatIntervalLabel } from '../../lib/utils'

export interface PlanPreviewCardProps {
  plan: { name: string; description: string; features?: string[] }
  merchant: { name: string; logo?: string }
  amount: string
  interval: number | string
  display?: { color?: string; badge?: string }
  logoPreviewUrl?: string
  /** Max features to show before collapsing with "+N more". 0 = show all. */
  maxFeatures?: number
}

/** Resolve a logo path — if relative, resolve against the relayer URL */
export function resolveLogoUrl(logo: string, baseUrl?: string): string {
  if (logo.startsWith('http') || logo.startsWith('blob:')) return logo
  if (baseUrl) {
    try {
      const base = new URL(baseUrl)
      return `${base.origin}${logo.startsWith('/') ? '' : '/'}${logo}`
    } catch { /* fall through */ }
  }
  const relayerUrl = import.meta.env.VITE_RELAYER_URL || ''
  return `${relayerUrl}/logos/${logo}`
}

export function PlanPreviewCard({
  plan,
  merchant,
  amount,
  interval,
  display,
  logoPreviewUrl,
  maxFeatures = 0,
}: PlanPreviewCardProps) {
  const accentColor = display?.color || '#6366F1'
  const [logoError, setLogoError] = React.useState(false)

  const logoUrl = logoPreviewUrl
    ? logoPreviewUrl
    : merchant.logo && !logoError
      ? resolveLogoUrl(merchant.logo)
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
            {merchant.name.charAt(0) || '?'}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{merchant.name || 'Merchant'}</p>
      </div>

      {/* Plan card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">{plan.name || 'Plan Name'}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {plan.description || 'Plan description'}
            </p>
          </div>
          {display?.badge && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white shrink-0 ml-2"
              style={{ background: accentColor }}
            >
              {display.badge}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1.5 mb-4">
          <span className="text-3xl font-bold">
            ${amount ? formatUSDCString(amount) : '0.00'}
          </span>
          <span className="text-sm text-muted-foreground">
            USDC / {formatIntervalLabel(interval)}
          </span>
        </div>

        {/* Features */}
        {plan.features && plan.features.length > 0 && (() => {
          const visible = maxFeatures > 0 ? plan.features.slice(0, maxFeatures) : plan.features
          const remaining = maxFeatures > 0 ? plan.features.length - maxFeatures : 0
          return (
            <div className="space-y-2 pt-3 border-t border-border">
              {visible.map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
                  <span>{feature}</span>
                </div>
              ))}
              {remaining > 0 && (
                <p className="text-xs text-muted-foreground pl-6">
                  +{remaining} more feature{remaining > 1 ? 's' : ''}
                </p>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
