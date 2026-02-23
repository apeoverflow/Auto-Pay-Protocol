import * as React from 'react'
import { Shield, Loader2, AlertCircle, ChevronDown } from 'lucide-react'
import { useWallet } from '../../hooks'

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

interface WalletSetupStepProps {
  cancelUrl: string
}

export function WalletSetupStep({ cancelUrl }: WalletSetupStepProps) {
  const { setupWallet, isSettingUp, setupStatus, setupError } = useWallet()

  const handleSetup = async () => {
    try {
      await setupWallet()
    } catch {
      // Error is displayed via setupError state
    }
  }

  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Shield className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Authorize USDC</h2>
        <p className="text-sm text-muted-foreground mt-1">
          One-time approval to let the contract manage your subscriptions
        </p>
      </div>

      <div className="rounded-lg bg-muted/50 px-4 py-3 mb-6 text-xs text-muted-foreground space-y-2">
        <p>This authorizes the AutoPay smart contract to charge your USDC according to your subscription terms:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Only charges the exact amount you approved</li>
          <li>Cannot exceed spending cap</li>
          <li>You can cancel anytime</li>
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

      <div className="text-center mt-3">
        <a href={cancelUrl} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </a>
      </div>
    </div>
  )
}
