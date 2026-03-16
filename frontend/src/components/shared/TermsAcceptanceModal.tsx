import { useState } from 'react'
import { Shield, ExternalLink, Loader2 } from 'lucide-react'
import { useTerms } from '../../contexts/TermsContext'

export function TermsAcceptanceModal() {
  const { acceptTerms, isAccepting, termsVersion } = useTerms()
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAccept = async () => {
    setError(null)
    try {
      await acceptTerms()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign'
      if (message.toLowerCase().includes('user rejected') || message.toLowerCase().includes('denied')) {
        setError('Signature rejected. You must sign to use the platform.')
      } else {
        setError(message)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Terms of Service</h2>
            <p className="text-xs text-muted-foreground">Version {termsVersion}</p>
          </div>
        </div>

        <div className="text-sm text-muted-foreground space-y-3">
          <p>
            Before using AutoPay Protocol, please review and accept our Terms of Service and Privacy Policy.
          </p>
          <p>
            You will be asked to sign a message with your wallet to confirm your acceptance. This signature is stored locally and does not execute any transaction or cost gas.
          </p>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Read Terms of Service
          </a>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Read Privacy Policy
          </a>
        </div>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm text-foreground/90">
            I have read and agree to the{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Privacy Policy
            </a>.
          </span>
        </label>

        {error && (
          <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          onClick={handleAccept}
          disabled={!checked || isAccepting}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isAccepting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sign with wallet...
            </>
          ) : (
            'Sign & Accept'
          )}
        </button>
      </div>
    </div>
  )
}
