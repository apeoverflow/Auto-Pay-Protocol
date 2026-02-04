import * as React from 'react'
import { useAuth, useWallet, useChain, useRecovery } from '../hooks'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import {
  Wallet,
  Shield,
  Copy,
  Check,
  Bell,
  Globe,
  AlertTriangle,
  Loader2,
  Settings,
  ExternalLink,
} from 'lucide-react'

export function SettingsPage() {
  const { username } = useAuth()
  const { account } = useWallet()
  const { chainConfig } = useChain()
  const {
    recoveryMnemonic,
    recoveryStatus,
    hasRecoveryKey,
    isLoading,
    generateRecoveryKey,
    clearRecovery,
  } = useRecovery()

  const [copied, setCopied] = React.useState(false)
  const [mnemonicCopied, setMnemonicCopied] = React.useState(false)

  const copyAddress = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const copyMnemonic = () => {
    if (recoveryMnemonic) {
      navigator.clipboard.writeText(recoveryMnemonic)
      setMnemonicCopied(true)
      setTimeout(() => setMnemonicCopied(false), 2000)
    }
  }

  return (
    <div className="h-full overflow-auto">
      <div className="space-y-3 md:space-y-6">
        {/* Main Grid */}
        <div className="grid gap-2.5 md:gap-6 lg:grid-cols-3">
          {/* Account Card */}
          <Card>
            <CardHeader className="py-2.5 md:py-3.5 px-3.5 md:px-5 border-b border-border/50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 md:h-8 md:w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
                    <Wallet className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                  </div>
                  <CardTitle className="text-[14px] md:text-[15px] font-semibold">Account</CardTitle>
                </div>
                <Badge variant="secondary" className="text-[11px] md:text-xs font-medium flex-shrink-0">
                  Passkey
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-3.5 md:p-5 space-y-3 md:space-y-4">
              <div>
                <label className="text-[10px] md:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Wallet Address</label>
                <div className="flex items-center gap-1.5 mt-1">
                  <code className="flex-1 bg-muted px-2 md:px-2.5 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-mono truncate border border-border">
                    {account?.address}
                  </code>
                  <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0 rounded-lg hover:bg-muted" onClick={copyAddress}>
                    {copied ? <Check className="h-3 w-3 md:h-3.5 md:w-3.5 text-success" /> : <Copy className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground" />}
                  </Button>
                </div>
              </div>

              {username && (
                <div>
                  <label className="text-[10px] md:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Username</label>
                  <p className="text-[13px] md:text-sm font-medium mt-0.5">{username}</p>
                </div>
              )}

              <div className="pt-2.5 md:pt-3 border-t border-border/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
                    <Globe className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-[13px] md:text-sm font-medium truncate">{chainConfig.name}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] md:text-xs font-mono flex-shrink-0">Chain {chainConfig.chain.id}</Badge>
                </div>
              </div>

              <a
                href={`${chainConfig.explorer}/address/${account?.address}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 text-[11px] md:text-xs text-primary hover:underline font-medium"
              >
                View on Explorer <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>

          {/* Security Card */}
          <Card>
            <CardHeader className="py-2.5 md:py-3.5 px-3.5 md:px-5 border-b border-border/50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 md:h-8 md:w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
                    <Shield className="h-3.5 w-3.5 md:h-4 md:w-4 text-emerald-600" />
                  </div>
                  <CardTitle className="text-[14px] md:text-[15px] font-semibold">Security</CardTitle>
                </div>
                {hasRecoveryKey && (
                  <Badge variant="success" className="text-[11px] md:text-xs font-medium flex-shrink-0">Protected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-3.5 md:p-5 space-y-3 md:space-y-4">
              <p className="text-[11px] md:text-xs text-muted-foreground leading-relaxed">
                Recovery key lets you regain access if you lose your passkey.
              </p>

              {!recoveryMnemonic ? (
                <Button
                  onClick={generateRecoveryKey}
                  disabled={isLoading}
                  size="sm"
                  className="w-full h-8 md:h-9 text-[13px] md:text-sm"
                  variant={hasRecoveryKey ? 'outline' : 'default'}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : hasRecoveryKey ? (
                    'Regenerate Key'
                  ) : (
                    'Generate Recovery Key'
                  )}
                </Button>
              ) : (
                <div className="space-y-2.5">
                  <div className="p-2.5 md:p-3 bg-warning/10 border border-warning/20 rounded-lg text-[11px] md:text-xs">
                    <p className="font-semibold text-warning-foreground mb-1">Save this phrase!</p>
                    <code className="block font-mono text-[11px] md:text-xs break-all leading-relaxed">{recoveryMnemonic}</code>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 h-7 md:h-8 text-[11px] md:text-xs" onClick={copyMnemonic}>
                      {mnemonicCopied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      Copy
                    </Button>
                    <Button size="sm" className="flex-1 h-7 md:h-8 text-[11px] md:text-xs" onClick={clearRecovery}>
                      <Check className="h-3 w-3 mr-1" />
                      Done
                    </Button>
                  </div>
                </div>
              )}

              {recoveryStatus && (
                <p className={`text-[11px] md:text-xs ${recoveryStatus.startsWith('Error') ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {recoveryStatus}
                </p>
              )}

              {hasRecoveryKey && !recoveryMnemonic && (
                <div className="flex items-center gap-1.5 text-[11px] md:text-xs text-success font-medium">
                  <Check className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  Recovery key registered
                </div>
              )}

              {/* Emergency Recovery Info */}
              <div className="border-t border-border/40 pt-3 md:pt-4 mt-1 md:mt-4">
                <div className="flex items-center gap-1.5 mb-2 md:mb-3">
                  <AlertTriangle className="h-3 w-3 md:h-3.5 md:w-3.5 text-amber-600" />
                  <span className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Emergency Info</span>
                </div>
                <div className="space-y-1.5 md:space-y-2 text-[11px] md:text-xs">
                  <div>
                    <span className="text-muted-foreground">Network: </span>
                    <span className="font-medium">{chainConfig.name} (Chain {chainConfig.chain.id})</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Recovery: </span>
                    <span className="font-medium">Import seed phrase into MetaMask, then sign to wallet</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preferences Card */}
          <Card>
            <CardHeader className="py-2.5 md:py-3.5 px-3.5 md:px-5 border-b border-border/50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 md:h-8 md:w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
                    <Settings className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                  </div>
                  <CardTitle className="text-[14px] md:text-[15px] font-semibold">Preferences</CardTitle>
                </div>
                <Badge variant="secondary" className="text-[11px] md:text-xs font-medium flex-shrink-0">Soon</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-3.5 md:p-5 space-y-3 md:space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-2.5">
                  <Bell className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                  <div>
                    <p className="text-[13px] md:text-sm font-medium">Notifications</p>
                    <p className="text-[11px] md:text-xs text-muted-foreground">Alerts for charges</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="h-7 md:h-8 text-[11px] md:text-xs" disabled>
                  Configure
                </Button>
              </div>

              <div className="border-t border-border/40 pt-3 md:pt-4">
                <p className="text-[11px] md:text-xs text-muted-foreground leading-relaxed">
                  More settings coming soon including custom RPC, gas preferences, and theme options.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
