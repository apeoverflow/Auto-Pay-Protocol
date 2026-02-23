import * as React from 'react'
import { useAuth, useWallet, useChain } from '../hooks'
import { Card, CardContent } from '../components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import {
  Wallet,
  Copy,
  Check,
  Bell,
  Globe,
  Settings,
  ExternalLink,
} from 'lucide-react'

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function SettingsPage() {
  const { username } = useAuth()
  const { address } = useWallet()
  const { chainConfig } = useChain()

  const [copied, setCopied] = React.useState(false)

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-3xl flex flex-col gap-4">
        {/* Wallet Identity Banner */}
        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">Wallet Address</p>
            <code className="text-sm font-mono font-medium text-foreground">
              {address ? truncateAddress(address) : '—'}
            </code>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={copyAddress}
            disabled={!address}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </Button>
        </div>

        {/* Tabbed Card */}
        <Card>
          <Tabs defaultValue="account" className="w-full">
            <div className="px-4 pt-4">
              <TabsList>
                <TabsTrigger value="account" className="gap-1.5">
                  <Wallet className="h-3.5 w-3.5" />
                  Account
                </TabsTrigger>
                <TabsTrigger value="network" className="gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Network
                </TabsTrigger>
                <TabsTrigger value="preferences" className="gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  Preferences
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Account Tab */}
            <TabsContent value="account">
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Wallet Address</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted/50 border border-border/50 px-3 py-2.5 rounded-lg text-xs font-mono truncate">
                      {address}
                    </code>
                    <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0 rounded-lg hover:bg-muted" onClick={copyAddress}>
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>

                {username && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Display Name</label>
                    <p className="text-sm font-medium">{username}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Connection</label>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-medium">Browser Wallet</Badge>
                  </div>
                </div>

                <div className="pt-1">
                  <a
                    href={`${chainConfig.explorer}/address/${address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                  >
                    View on Explorer <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </TabsContent>

            {/* Network Tab */}
            <TabsContent value="network">
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active Network</label>
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-medium">{chainConfig.name}</span>
                    <Badge variant="outline" className="text-xs font-mono">Chain {chainConfig.chain.id}</Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Explorer</label>
                  <a
                    href={chainConfig.explorer}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                  >
                    {chainConfig.explorer} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="rounded-lg bg-muted/30 border border-border/50 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    Network is determined by your connected wallet. To switch networks, change it in your wallet provider (MetaMask, Rabby, etc).
                  </p>
                </div>
              </CardContent>
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences">
              <CardContent className="p-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Notifications</p>
                        <p className="text-xs text-muted-foreground">Alerts for charges &amp; renewals</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs" disabled>
                      Configure
                    </Button>
                  </div>

                  <div className="flex flex-col items-center justify-center py-6 text-center border-t border-border/40">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 mb-3">
                      <Settings className="h-4.5 w-4.5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">More Settings Coming Soon</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      Custom RPC endpoints, gas preferences, and theme options will be available here.
                    </p>
                  </div>
                </div>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
