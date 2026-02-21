import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Wallet } from 'lucide-react'

interface AuthStepProps {
  cancelUrl: string
}

export function AuthStep({ cancelUrl }: AuthStepProps) {
  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Wallet className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Connect wallet</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your wallet to continue
        </p>
      </div>

      <div className="flex justify-center">
        <ConnectButton />
      </div>

      <div className="text-center mt-4">
        <a href={cancelUrl} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </a>
      </div>
    </div>
  )
}
