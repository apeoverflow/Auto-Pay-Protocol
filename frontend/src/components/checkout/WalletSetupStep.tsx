import { Shield, Loader2, AlertCircle } from 'lucide-react'
import { useWallet } from '../../hooks'

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

      {setupError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 mb-4">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>{setupError}</p>
        </div>
      )}

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
