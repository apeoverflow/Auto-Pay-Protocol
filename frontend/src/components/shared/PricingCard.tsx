import * as React from 'react'
import { Check } from 'lucide-react'
import { formatUSDCString, formatIntervalLabel } from '../../lib/utils'
import { resolveLogoUrl, type PlanPreviewCardProps } from './PlanPreviewCard'

export function PricingCard({
  plan,
  merchant,
  amount,
  interval,
  display,
  logoPreviewUrl,
  maxFeatures = 0,
}: PlanPreviewCardProps) {
  const accentColor = display?.color || '#6366F1'
  const hasBadge = !!display?.badge
  const [logoError, setLogoError] = React.useState(false)

  // Reset error when logo changes (e.g. new upload)
  React.useEffect(() => { setLogoError(false) }, [merchant.logo, logoPreviewUrl])

  const logoUrl = logoPreviewUrl
    ? logoPreviewUrl
    : merchant.logo && !logoError
      ? resolveLogoUrl(merchant.logo)
      : null

  return (
    <div
      className="relative rounded-2xl border bg-card p-6 flex flex-col"
      style={{
        borderColor: hasBadge ? accentColor : undefined,
        boxShadow: hasBadge ? `0 4px 24px ${accentColor}20` : undefined,
      }}
    >
      {/* Badge */}
      {hasBadge && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold px-3 py-0.5 rounded-full text-white"
          style={{ background: accentColor }}
        >
          {display!.badge}
        </span>
      )}

      {/* Merchant */}
      <div className="flex items-center gap-2 mb-4">
        {logoUrl ? (
          <img src={logoUrl} alt={merchant.name} onError={() => setLogoError(true)} className="w-8 h-8 rounded-lg object-cover" />
        ) : (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: accentColor }}
          >
            {(merchant.name || '?').charAt(0)}
          </div>
        )}
        <span className="text-sm font-medium text-muted-foreground">{merchant.name || 'Merchant'}</span>
      </div>

      {/* Plan name */}
      <h3 className="text-lg font-semibold mb-1">{plan.name || 'Plan Name'}</h3>
      <p className="text-sm text-muted-foreground mb-4">{plan.description || 'Plan description'}</p>

      {/* Price */}
      <div className="flex items-baseline gap-1 mb-5">
        <span className="text-4xl font-bold">${amount ? formatUSDCString(amount) : '0.00'}</span>
        <span className="text-sm text-muted-foreground">USDC / {formatIntervalLabel(interval)}</span>
      </div>

      {/* Subscribe button */}
      <button
        className="w-full h-11 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 mb-5"
        style={{ background: accentColor }}
        type="button"
        tabIndex={-1}
      >
        Subscribe with AutoPay
      </button>

      {/* Features */}
      {plan.features && plan.features.length > 0 && (() => {
        const visible = maxFeatures > 0 ? plan.features.slice(0, maxFeatures) : plan.features
        const remaining = maxFeatures > 0 ? plan.features.length - maxFeatures : 0
        return (
          <div className="space-y-2 pt-4 border-t border-border">
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
  )
}
