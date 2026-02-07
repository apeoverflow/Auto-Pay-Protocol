import * as React from 'react'
import { CheckCircle, ExternalLink, Settings } from 'lucide-react'
import type { CheckoutMetadata } from '../../types/checkout'
import { formatUSDCString, formatIntervalLabel } from '../../lib/utils'
import { useChain } from '../../hooks'

interface SuccessStepProps {
  metadata: CheckoutMetadata
  policyId: string
  txHash?: string
  amount: string
  interval: number
  successUrl: string
}

export function SuccessStep({ metadata, policyId, txHash, amount, interval, successUrl }: SuccessStepProps) {
  const { chainConfig } = useChain()
  const [countdown, setCountdown] = React.useState(5)

  // Build redirect URL with policyId
  const redirectUrl = React.useMemo(() => {
    const url = new URL(successUrl)
    url.searchParams.set('policy_id', policyId)
    if (txHash) url.searchParams.set('tx_hash', txHash)
    return url.toString()
  }, [successUrl, policyId, txHash])

  // Auto-redirect countdown
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer)
          window.location.href = redirectUrl
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [redirectUrl])

  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-9 h-9 text-green-500" />
      </div>

      <h2 className="text-xl font-semibold mb-1">Subscription active!</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Your first payment of ${formatUSDCString(amount)} USDC has been processed
      </p>

      <div className="rounded-xl border border-border bg-card p-4 mb-6 text-left space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Plan</span>
          <span className="font-medium">{metadata.plan.name}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-medium">${formatUSDCString(amount)} USDC</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Next charge</span>
          <span className="font-medium">In {formatIntervalLabel(interval)}</span>
        </div>
      </div>

      {txHash && (
        <a
          href={`${chainConfig.explorer}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mb-4"
        >
          View transaction
          <ExternalLink className="w-3 h-3" />
        </a>
      )}

      <div className="flex items-center justify-center gap-3 mt-4">
        <a
          href="/subscriptions"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <Settings className="w-3 h-3" />
          Manage subscriptions
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
        <span className="text-xs text-muted-foreground/50">&middot;</span>
        <a
          href="/bridge"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          Top up wallet
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Redirecting to {metadata.merchant.name} in {countdown}s...
      </p>

      <a
        href={redirectUrl}
        className="inline-block mt-2 text-sm font-medium text-primary hover:underline"
      >
        Go now
      </a>
    </div>
  )
}
