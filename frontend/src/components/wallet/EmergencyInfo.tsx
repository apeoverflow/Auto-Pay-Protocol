import { useWallet, useChain } from '../../hooks'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { AlertTriangle, ExternalLink, ChevronDown } from 'lucide-react'

export function EmergencyInfo() {
  const { address } = useWallet()
  const { chainConfig } = useChain()

  if (!address) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <CardTitle className="text-lg">Emergency Access</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Your funds are stored on-chain. You can always access them directly using your wallet
          and the contract addresses below.
        </p>

        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-primary hover:text-primary/80 transition-colors">
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            <span className="text-sm font-medium">Show emergency recovery details</span>
          </summary>

          <div className="mt-4 p-4 bg-muted rounded-lg space-y-4 text-sm">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide">
                Wallet Address
              </label>
              <code className="block mt-1 font-mono text-xs break-all">
                {address}
              </code>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide">
                Network
              </label>
              <p className="mt-1">{chainConfig.name} (Chain ID: {chainConfig.chain.id})</p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide">
                USDC Contract
              </label>
              <code className="block mt-1 font-mono text-xs break-all">
                {chainConfig.usdc}
              </code>
            </div>

            <div className="border-t pt-4">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">
                To access funds without this app
              </label>
              <ol className="mt-2 list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Connect your wallet to {chainConfig.name} network</li>
                <li>Interact with the USDC contract directly to transfer funds</li>
                <li>
                  <a
                    href={`${chainConfig.explorer}/address/${address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    View wallet on Explorer
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              </ol>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
