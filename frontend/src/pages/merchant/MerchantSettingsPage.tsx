import * as React from 'react'
import { Card, CardContent } from '../../components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { useWallet } from '../../hooks/useWallet'
import {
  Copy,
  Check,
  ExternalLink,
  Server,
  Wallet,
  Code2,
  Bell,
  Info,
} from 'lucide-react'
import {
  getCustomRelayerConfig,
  setCustomRelayerConfig,
  clearCustomRelayerConfig,
} from '../../lib/relayer'

const RELAYER_URL = import.meta.env.VITE_RELAYER_URL || ''

const ENDPOINTS = [
  { method: 'GET', path: '/merchants/:address/plans' },
  { method: 'POST', path: '/merchants/:address/plans' },
  { method: 'GET', path: '/merchants/:address/plans/:id' },
  { method: 'PUT', path: '/merchants/:address/plans/:id' },
  { method: 'PATCH', path: '/merchants/:address/plans/:id' },
  { method: 'DELETE', path: '/merchants/:address/plans/:id' },
] as const

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  POST: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  PUT: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  PATCH: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  DELETE: 'bg-red-500/10 text-red-700 border-red-500/20',
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function MerchantSettingsPage() {
  const { address } = useWallet()
  const [copiedAddress, setCopiedAddress] = React.useState(false)
  const [copiedEndpoint, setCopiedEndpoint] = React.useState(false)

  // Custom relayer config
  const [customUrl, setCustomUrl] = React.useState('')
  const [customApiKey, setCustomApiKey] = React.useState('')
  const [relayerSaved, setRelayerSaved] = React.useState(false)
  const [relayerError, setRelayerError] = React.useState<string | null>(null)

  // Load saved config on mount
  React.useEffect(() => {
    if (!address) return
    const saved = getCustomRelayerConfig(address)
    if (saved) {
      setCustomUrl(saved.url)
      setCustomApiKey(saved.apiKey)
    }
  }, [address])

  const plansEndpoint = RELAYER_URL
    ? `${RELAYER_URL}/merchants/${address}/plans`
    : `<relayer-url>/merchants/${address}/plans`

  const handleCopy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  const handleSaveRelayer = () => {
    if (!address || !customUrl.trim()) return
    setRelayerError(null)
    // Validate URL scheme — only HTTPS (or localhost HTTP for dev)
    try {
      const parsed = new URL(customUrl.trim())
      const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
      if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalhost)) {
        setRelayerError('Relayer URL must use HTTPS (or HTTP for localhost only).')
        return
      }
    } catch {
      setRelayerError('Invalid URL format.')
      return
    }
    setCustomRelayerConfig(address, { url: customUrl.trim(), apiKey: customApiKey })
    setRelayerSaved(true)
    setTimeout(() => setRelayerSaved(false), 2000)
  }

  const handleClearRelayer = () => {
    if (!address) return
    clearCustomRelayerConfig(address)
    setCustomUrl('')
    setCustomApiKey('')
  }

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-4">
      {/* Merchant Identity Banner */}
      <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/15 to-purple-500/10">
          <Wallet className="h-4 w-4 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">Merchant Address</p>
          <code className="text-sm font-mono font-medium text-foreground">
            {address ? truncateAddress(address) : '—'}
          </code>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => address && handleCopy(address, setCopiedAddress)}
          disabled={!address}
        >
          {copiedAddress ? (
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
        <Tabs defaultValue="api" className="w-full">
          <div className="px-4 pt-4">
            <TabsList>
              <TabsTrigger value="api" className="gap-1.5">
                <Code2 className="h-3.5 w-3.5" />
                API Reference
              </TabsTrigger>
              <TabsTrigger value="relayer" className="gap-1.5">
                <Server className="h-3.5 w-3.5" />
                Custom Relayer
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="gap-1.5">
                <Bell className="h-3.5 w-3.5" />
                Webhooks
              </TabsTrigger>
            </TabsList>
          </div>

          {/* API Reference Tab */}
          <TabsContent value="api">
            <CardContent className="p-5 space-y-5">
              {/* Plans Endpoint */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Plans Endpoint</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-muted/50 border border-border/50 px-3 py-2.5 text-xs font-mono break-all text-foreground">
                    {plansEndpoint}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 flex-shrink-0"
                    onClick={() => handleCopy(plansEndpoint, setCopiedEndpoint)}
                  >
                    {copiedEndpoint ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Endpoints Table */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Available Endpoints</label>
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-20">Method</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Path</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ENDPOINTS.map((ep, i) => (
                        <tr key={i} className="border-t border-border/30">
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${METHOD_COLORS[ep.method]}`}
                            >
                              {ep.method}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">{ep.path}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Auth Note */}
              <p className="text-xs text-muted-foreground">
                Write operations require EIP-191 signature auth via{' '}
                <code className="text-[11px] bg-muted/50 px-1 py-0.5 rounded">X-Address</code>,{' '}
                <code className="text-[11px] bg-muted/50 px-1 py-0.5 rounded">X-Signature</code>,{' '}
                <code className="text-[11px] bg-muted/50 px-1 py-0.5 rounded">X-Nonce</code> headers.
                See the{' '}
                <a
                  href="/docs?doc=merchant-guide&section=authenticated-api"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  documentation <ExternalLink className="h-2.5 w-2.5" />
                </a>{' '}
                for details.
              </p>
            </CardContent>
          </TabsContent>

          {/* Custom Relayer Tab */}
          <TabsContent value="relayer">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-2 rounded-lg bg-blue-500/5 border border-blue-500/10 px-3 py-2.5">
                <Info className="h-3.5 w-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700/80">
                  Only configure this if you run your own relayer instance. Dashboard data will be
                  fetched from your relayer instead of the default AutoPay relayer.
                </p>
              </div>
              <Input
                label="Relayer URL"
                placeholder="https://relayer.mysite.com"
                value={customUrl}
                onChange={(e) => { setCustomUrl(e.target.value); setRelayerError(null) }}
              />
              <Input
                label="API Key"
                type="password"
                placeholder="Optional"
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
              />
              {relayerError && (
                <p className="text-xs text-destructive">{relayerError}</p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveRelayer}
                  disabled={!customUrl.trim()}
                >
                  {relayerSaved ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1.5" /> Saved
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearRelayer}
                  disabled={!customUrl && !customApiKey}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks">
            <CardContent className="p-5">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 mb-3">
                  <Bell className="h-4.5 w-4.5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Coming Soon</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Webhook management will be available here. Currently, webhooks can be configured
                  via the relayer's environment variables.
                </p>
              </div>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}
