import * as React from 'react'
import { Card, CardContent } from '../../components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { useWallet } from '../../hooks/useWallet'
import { useSignMessage } from 'wagmi'
import {
  Copy,
  Check,
  Server,
  Code2,
  Bell,
  Info,
  KeyRound,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
  Play,
  Download,
  ChevronDown,
  ChevronUp,
  RotateCw,
} from 'lucide-react'
import { useChain } from '../../hooks/useChain'
import {
  getCustomRelayerConfig,
  setCustomRelayerConfig,
  clearCustomRelayerConfig,
  createMerchantApiKey,
  listMerchantApiKeys,
  revokeMerchantApiKey,
  getWebhookConfig,
  setWebhookUrl,
  deleteWebhook,
  rotateWebhookSecret,
  type MerchantApiKey,
  type WebhookConfig,
} from '../../lib/relayer'

const RELAYER_URL = import.meta.env.VITE_RELAYER_URL || ''

const ENDPOINTS = [
  { method: 'GET', path: '/merchants/:address/subscribers?chain_id=:chainId', auth: 'key' as const, title: 'List Subscribers', info: 'Returns active subscribers with policy details, charge amounts, and next payment dates. Paginated: page (default 1), limit (default 50, max 100).' },
  { method: 'GET', path: '/merchants/:address/charges?chain_id=:chainId', auth: 'key' as const, title: 'List Charges', info: 'Returns charge history including amounts, fees, timestamps, and transaction hashes. Paginated: page (default 1), limit (default 50, max 100).' },
  { method: 'GET', path: '/merchants/:address/stats?chain_id=:chainId', auth: 'key' as const, title: 'Merchant Stats', info: 'Returns aggregate stats: total revenue, active subscribers, MRR, and churn rate.' },
  { method: 'GET', path: '/merchants/:address/reports?chain_id=:chainId', auth: 'public' as const, title: 'List Reports', info: 'Returns available report periods (e.g. 2026-01, 2026-02) with summary totals.' },
  { method: 'GET', path: '/merchants/:address/reports/:period?chain_id=:chainId', auth: 'key' as const, title: 'Get Report', info: 'Returns a detailed report for a specific period with per-subscriber breakdowns and receipt links.' },
  { method: 'GET', path: '/merchants/:address/reports/:period/csv?chain_id=:chainId', auth: 'key' as const, title: 'Export Report CSV', info: 'Downloads the report as a CSV file for accounting and bookkeeping.' },
  { method: 'GET', path: '/merchants/:address/plans', auth: 'public' as const, title: 'List Plans', info: 'Returns all published subscription plans. Used by checkout pages to display available plans.' },
  { method: 'POST', path: '/merchants/:address/plans', auth: 'signature' as const, title: 'Create Plan', info: 'Creates a new subscription plan with name, price, interval, and metadata.' },
  { method: 'PUT', path: '/merchants/:address/plans/:id', auth: 'signature' as const, title: 'Update Plan', info: 'Replaces all fields of an existing plan. Existing subscribers are not affected.' },
  { method: 'PATCH', path: '/merchants/:address/plans/:id', auth: 'signature' as const, title: 'Publish / Unpublish', info: 'Toggle a plan\'s published status to show or hide it from checkout.' },
  { method: 'DELETE', path: '/merchants/:address/plans/:id', auth: 'signature' as const, title: 'Delete Plan', info: 'Permanently deletes a draft plan. Published plans must be unpublished first.' },
  { method: 'POST', path: '/merchants/:address/receipts/upload', auth: 'signature' as const, title: 'Upload Receipts', info: 'Uploads charge receipts to IPFS/Filecoin for immutable, verifiable record-keeping.' },
]

function resolveEndpointUrl(path: string, baseUrl: string, address: string, chainId: number): string {
  return baseUrl + path.replace(/:address/g, address).replace(/:chainId/g, String(chainId))
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  POST: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  PUT: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  PATCH: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  DELETE: 'bg-red-500/10 text-red-700 border-red-500/20',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function MerchantSettingsPage() {
  const { address } = useWallet()
  const { chainConfig } = useChain()
  const { signMessageAsync } = useSignMessage()
  const [copiedEndpoint, setCopiedEndpoint] = React.useState(false)
  const [copiedRowIdx, setCopiedRowIdx] = React.useState<number | null>(null)

  // Custom relayer config
  const [customUrl, setCustomUrl] = React.useState('')
  const [customApiKey, setCustomApiKey] = React.useState('')
  const [relayerSaved, setRelayerSaved] = React.useState(false)
  const [relayerError, setRelayerError] = React.useState<string | null>(null)

  // API Keys state
  const [apiKeys, setApiKeys] = React.useState<MerchantApiKey[]>([])
  const [keysLoading, setKeysLoading] = React.useState(false)
  const [keysError, setKeysError] = React.useState<string | null>(null)
  const [newKeyLabel, setNewKeyLabel] = React.useState('')
  const [creating, setCreating] = React.useState(false)
  const [newKey, setNewKey] = React.useState<string | null>(null)
  const [copiedKey, setCopiedKey] = React.useState(false)
  const [showNewKey, setShowNewKey] = React.useState(true)
  const [revokingId, setRevokingId] = React.useState<number | null>(null)

  // Webhook state
  const [webhookConfig, setWebhookConfigState] = React.useState<WebhookConfig | null>(null)
  const [webhookLoading, setWebhookLoading] = React.useState(false)
  const [webhookError, setWebhookError] = React.useState<string | null>(null)
  const [webhookUrlInput, setWebhookUrlInput] = React.useState('')
  const [webhookSaving, setWebhookSaving] = React.useState(false)
  const [webhookEditing, setWebhookEditing] = React.useState(false)
  const [shownSecret, setShownSecret] = React.useState<string | null>(null)
  const [copiedSecret, setCopiedSecret] = React.useState(false)
  const [rotatingSecret, setRotatingSecret] = React.useState(false)
  const [confirmRotate, setConfirmRotate] = React.useState(false)
  const [confirmRemove, setConfirmRemove] = React.useState(false)
  const [removingWebhook, setRemovingWebhook] = React.useState(false)
  const [showPayloadExample, setShowPayloadExample] = React.useState(false)
  const [webhookTabLoaded, setWebhookTabLoaded] = React.useState(false)

  // Load webhook config when tab is activated
  const loadWebhookConfig = React.useCallback(async () => {
    if (!address) return
    setWebhookLoading(true)
    setWebhookError(null)
    try {
      const config = await getWebhookConfig(address, signMessageAsync)
      setWebhookConfigState(config)
      if (config.webhookUrl) {
        setWebhookUrlInput(config.webhookUrl)
      }
    } catch (err) {
      setWebhookError(err instanceof Error ? err.message : 'Failed to load webhook config')
    } finally {
      setWebhookLoading(false)
    }
  }, [address, signMessageAsync])

  const handleSaveWebhook = React.useCallback(async () => {
    if (!address || !webhookUrlInput.trim()) return
    setWebhookSaving(true)
    setWebhookError(null)
    setShownSecret(null)
    try {
      const result = await setWebhookUrl(address, webhookUrlInput.trim(), signMessageAsync)
      setWebhookConfigState({ webhookUrl: result.webhookUrl, hasSecret: true })
      setWebhookEditing(false)
      if (result.isNew && result.webhookSecret) {
        setShownSecret(result.webhookSecret)
      }
    } catch (err) {
      setWebhookError(err instanceof Error ? err.message : 'Failed to save webhook')
    } finally {
      setWebhookSaving(false)
    }
  }, [address, webhookUrlInput, signMessageAsync])

  const handleRemoveWebhook = React.useCallback(async () => {
    if (!address) return
    setRemovingWebhook(true)
    setWebhookError(null)
    try {
      await deleteWebhook(address, signMessageAsync)
      setWebhookConfigState({ webhookUrl: null, hasSecret: false })
      setWebhookUrlInput('')
      setShownSecret(null)
      setWebhookEditing(false)
      setConfirmRemove(false)
    } catch (err) {
      setWebhookError(err instanceof Error ? err.message : 'Failed to remove webhook')
    } finally {
      setRemovingWebhook(false)
    }
  }, [address, signMessageAsync])

  const handleRotateSecret = React.useCallback(async () => {
    if (!address) return
    setRotatingSecret(true)
    setWebhookError(null)
    try {
      const result = await rotateWebhookSecret(address, signMessageAsync)
      setShownSecret(result.webhookSecret)
      setConfirmRotate(false)
    } catch (err) {
      setWebhookError(err instanceof Error ? err.message : 'Failed to rotate secret')
    } finally {
      setRotatingSecret(false)
    }
  }, [address, signMessageAsync])

  const copySecret = React.useCallback((secret: string) => {
    navigator.clipboard.writeText(secret)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 2000)
  }, [])

  // Load saved config on mount
  React.useEffect(() => {
    if (!address) return
    const saved = getCustomRelayerConfig(address)
    if (saved) {
      setCustomUrl(saved.url)
      setCustomApiKey(saved.apiKey)
    }
  }, [address])

  const effectiveRelayerUrl = (address ? getCustomRelayerConfig(address)?.url : null) || RELAYER_URL
  const plansEndpoint = effectiveRelayerUrl
    ? `${effectiveRelayerUrl}/merchants/${address}/plans`
    : `<relayer-url>/merchants/${address}/plans`

  const handleCopy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  const handleCopyRow = (idx: number) => {
    if (!address || !effectiveRelayerUrl) return
    const url = resolveEndpointUrl(ENDPOINTS[idx].path, effectiveRelayerUrl, address, chainConfig.chain.id)
    navigator.clipboard.writeText(url)
    setCopiedRowIdx(idx)
    setTimeout(() => setCopiedRowIdx(null), 2000)
  }

  const handleSaveRelayer = () => {
    if (!address || !customUrl.trim()) return
    setRelayerError(null)
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

  // Simulator state
  const [simulatorIdx, setSimulatorIdx] = React.useState<number | null>(null)
  const [simulatorParams, setSimulatorParams] = React.useState<{
    period: string
    planId: string
    page: string
    limit: string
  }>({ period: '', planId: '', page: '', limit: '' })
  const [simulatorResult, setSimulatorResult] = React.useState<{
    loading: boolean
    status: number | null
    body: string | null
    error: string | null
    csvBlob: Blob | null
  }>({ loading: false, status: null, body: null, error: null, csvBlob: null })

  // Indices of GET endpoints that are simulatable
  const SIMULATABLE_INDICES = [0, 1, 2, 3, 4, 5]

  const handleToggleSimulator = (idx: number) => {
    if (simulatorIdx === idx) {
      setSimulatorIdx(null)
    } else {
      setSimulatorIdx(idx)
      setSimulatorParams({ period: '', planId: '', page: '', limit: '' })
      setSimulatorResult({ loading: false, status: null, body: null, error: null, csvBlob: null })
    }
  }

  const handleTryEndpoint = async (idx: number) => {
    if (!address || !effectiveRelayerUrl) return
    const ep = ENDPOINTS[idx]
    setSimulatorResult({ loading: true, status: null, body: null, error: null, csvBlob: null })

    const isCsv = idx === 5
    const needsKey = ep.auth === 'key'
    let apiKey: string | null = null
    let tempKeyId: number | null = null

    // Buffer the result locally — only display after revoke completes
    let bufferedResult: typeof simulatorResult | null = null

    try {
      // Step 1: Create temp key if endpoint requires API Key auth
      if (needsKey) {
        const result = await createMerchantApiKey(address, '_simulator', signMessageAsync)
        apiKey = result.key
        tempKeyId = result.id
      }

      // Step 2: Build URL with params
      let path = ep.path
        .replace(/:address/g, encodeURIComponent(address))
        .replace(/:chainId/g, String(chainConfig.chain.id))

      if (path.includes(':period')) {
        if (!simulatorParams.period.trim()) {
          // Still revoke if key was created before bailing
          if (tempKeyId !== null) {
            await revokeMerchantApiKey(address, tempKeyId, signMessageAsync).catch(() => {})
          }
          setSimulatorResult({ loading: false, status: null, body: null, error: 'Period is required (e.g. 2026-02)', csvBlob: null })
          return
        }
        path = path.replace(/:period/g, encodeURIComponent(simulatorParams.period.trim()))
      }

      const url = new URL(effectiveRelayerUrl + path)
      if (simulatorParams.planId.trim() && idx === 0) {
        url.searchParams.set('plan_id', simulatorParams.planId.trim())
      }
      if (simulatorParams.page.trim() && (idx === 0 || idx === 1)) {
        url.searchParams.set('page', simulatorParams.page.trim())
      }
      if (simulatorParams.limit.trim() && (idx === 0 || idx === 1)) {
        url.searchParams.set('limit', simulatorParams.limit.trim())
      }

      // Step 3: Fetch — buffer result, don't display yet
      const headers: Record<string, string> = {}
      if (apiKey) headers['X-API-Key'] = apiKey

      const res = await fetch(url.toString(), { headers })

      if (isCsv && res.ok) {
        const blob = await res.blob()
        bufferedResult = { loading: false, status: res.status, body: null, error: null, csvBlob: blob }
      } else {
        let body: string
        try {
          const json = await res.json()
          body = JSON.stringify(json, null, 2)
        } catch {
          body = await res.text().catch(() => '(empty response)')
        }
        bufferedResult = { loading: false, status: res.status, body, error: null, csvBlob: null }
      }

      // Step 4: Revoke temp key BEFORE showing result
      if (tempKeyId !== null) {
        try {
          await revokeMerchantApiKey(address, tempKeyId, signMessageAsync)
        } catch {
          // Best-effort revoke
        }
        tempKeyId = null // prevent double-revoke in catch
      }

      // Step 5: Now display the result
      setSimulatorResult(bufferedResult)
    } catch (err) {
      // Revoke if we got a key but something else failed
      if (tempKeyId !== null) {
        await revokeMerchantApiKey(address, tempKeyId, signMessageAsync).catch(() => {})
      }
      setSimulatorResult(
        bufferedResult ?? {
          loading: false,
          status: null,
          body: null,
          error: err instanceof Error ? err.message : 'Request failed',
          csvBlob: null,
        }
      )
    }
  }

  const handleDownloadCsv = () => {
    if (!simulatorResult.csvBlob || !address) return
    const blobUrl = URL.createObjectURL(simulatorResult.csvBlob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `report-${address.toLowerCase()}-${simulatorParams.period || 'export'}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  }

  // API Keys handlers
  const loadKeys = React.useCallback(async () => {
    if (!address) return
    setKeysLoading(true)
    setKeysError(null)
    try {
      const keys = await listMerchantApiKeys(address, signMessageAsync)
      setApiKeys(keys)
    } catch (err) {
      setKeysError(err instanceof Error ? err.message : 'Failed to load API keys')
    } finally {
      setKeysLoading(false)
    }
  }, [address, signMessageAsync])

  const handleCreateKey = async () => {
    if (!address) return
    setCreating(true)
    setKeysError(null)
    try {
      const result = await createMerchantApiKey(address, newKeyLabel.trim(), signMessageAsync)
      setNewKey(result.key)
      setNewKeyLabel('')
      setShowNewKey(true)
      // Add new key to state directly — avoids a second wallet signature popup
      setApiKeys((prev) => [
        {
          id: result.id,
          keyPrefix: result.keyPrefix,
          label: result.label,
          createdAt: result.createdAt,
          lastUsedAt: null,
        },
        ...prev,
      ])
    } catch (err) {
      setKeysError(err instanceof Error ? err.message : 'Failed to create API key')
    } finally {
      setCreating(false)
    }
  }

  const handleRevokeKey = async (keyId: number) => {
    if (!address || !confirm('Revoke this API key? Any integrations using it will stop working.')) return
    setRevokingId(keyId)
    setKeysError(null)
    try {
      await revokeMerchantApiKey(address, keyId, signMessageAsync)
      setApiKeys((prev) => prev.filter((k) => k.id !== keyId))
    } catch (err) {
      setKeysError(err instanceof Error ? err.message : 'Failed to revoke API key')
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-4">
      {/* Tabbed Card */}
      <Card>
        <Tabs defaultValue="api" className="w-full">
          <div className="px-4 pt-4">
            <TabsList>
              <TabsTrigger value="api" className="gap-1.5">
                <Code2 className="h-3.5 w-3.5" />
                API Reference
              </TabsTrigger>
              <TabsTrigger value="keys" className="gap-1.5" onClick={loadKeys}>
                <KeyRound className="h-3.5 w-3.5" />
                API Keys
              </TabsTrigger>
              <TabsTrigger value="relayer" className="gap-1.5">
                <Server className="h-3.5 w-3.5" />
                Custom Relayer
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="gap-1.5" onClick={() => { if (!webhookTabLoaded) { setWebhookTabLoaded(true); loadWebhookConfig() } }}>
                <Bell className="h-3.5 w-3.5" />
                Webhooks
              </TabsTrigger>
            </TabsList>
          </div>

          {/* API Reference Tab */}
          <TabsContent value="api">
            <CardContent className="p-5">
            <div className="flex gap-5">
            <div className="flex-1 min-w-0 space-y-5">
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

              {/* Endpoints List */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Available Endpoints</label>
                <div className="rounded-lg border border-border/50 divide-y divide-border/30">
                  {ENDPOINTS.map((ep, i) => {
                    // Short display path: strip /merchants/:address prefix, resolve chainId only
                    const shortPath = ep.path
                      .replace('/merchants/:address', '')
                      .replace(/:chainId/g, String(chainConfig.chain.id))
                    const isSimulatable = SIMULATABLE_INDICES.includes(i)
                    const isSimOpen = simulatorIdx === i
                    return (
                      <div key={i}>
                        <div className="flex items-center gap-2 px-2.5 py-[7px] hover:bg-muted/30 transition-colors group/row">
                          <span
                            className={`inline-flex items-center rounded border px-1 py-px text-[9px] font-semibold leading-tight flex-shrink-0 w-[3.25rem] justify-center ${METHOD_COLORS[ep.method]}`}
                          >
                            {ep.method}
                          </span>
                          <span className="text-[11px] font-medium text-foreground whitespace-nowrap">{ep.title}</span>
                          <div className="relative group/tip flex-shrink-0">
                            <Info className="h-3 w-3 text-muted-foreground/30 hover:text-muted-foreground cursor-help transition-colors" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 rounded-lg border border-border bg-popover px-2.5 py-2 text-[11px] leading-relaxed text-popover-foreground shadow-md opacity-0 pointer-events-none group-hover/tip:opacity-100 group-hover/tip:pointer-events-auto transition-opacity z-50">
                              {ep.info}
                            </div>
                          </div>
                          <code className="flex-1 text-[10px] font-mono text-muted-foreground/50 truncate">
                            {shortPath.split(/(:[a-zA-Z_]+)/).map((part, j) =>
                              part.startsWith(':') ? (
                                <span key={j} className="text-foreground/70 font-semibold">{part}</span>
                              ) : (
                                <span key={j}>{part}</span>
                              )
                            )}
                          </code>
                          {ep.auth === 'key' ? (
                            <span className="inline-flex items-center rounded border border-violet-500/20 bg-violet-500/10 text-violet-700 px-1 py-px text-[9px] font-semibold leading-tight flex-shrink-0">
                              API Key
                            </span>
                          ) : ep.auth === 'signature' ? (
                            <span className="inline-flex items-center rounded border border-amber-500/20 bg-amber-500/10 text-amber-700 px-1 py-px text-[9px] font-semibold leading-tight flex-shrink-0">
                              Signature
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded border border-border bg-muted/30 text-muted-foreground px-1 py-px text-[9px] font-semibold leading-tight flex-shrink-0">
                              Public
                            </span>
                          )}
                          {isSimulatable && (
                            <button
                              className={`flex-shrink-0 inline-flex items-center justify-center h-5 px-1.5 rounded text-[9px] font-semibold transition-colors ${
                                isSimOpen
                                  ? 'bg-blue-500/15 text-blue-700 border border-blue-500/30'
                                  : 'hover:bg-muted/60 text-muted-foreground/40 group-hover/row:text-muted-foreground border border-transparent'
                              }`}
                              onClick={() => handleToggleSimulator(i)}
                              disabled={!address || !effectiveRelayerUrl}
                              title="Try this endpoint"
                            >
                              <Play className="h-2.5 w-2.5 mr-0.5" />
                              Try
                            </button>
                          )}
                          <button
                            className="flex-shrink-0 inline-flex items-center justify-center h-5 w-5 rounded hover:bg-muted/60 transition-colors text-muted-foreground/30 group-hover/row:text-muted-foreground disabled:opacity-40"
                            onClick={() => handleCopyRow(i)}
                            disabled={!address || !effectiveRelayerUrl}
                            title="Copy full URL"
                          >
                            {copiedRowIdx === i ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>

                        {/* Simulator Panel */}
                        {isSimOpen && (
                          <div className="border-t border-border/20 bg-muted/20 px-3 py-3 space-y-3">
                            {/* Parameter inputs */}
                            <div className="flex flex-wrap items-end gap-2">
                              {/* Period input for report endpoints */}
                              {(i === 4 || i === 5) && (
                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-medium text-muted-foreground">Period *</label>
                                  <input
                                    type="text"
                                    placeholder="2026-02"
                                    value={simulatorParams.period}
                                    onChange={(e) => setSimulatorParams((p) => ({ ...p, period: e.target.value }))}
                                    className="h-7 w-24 rounded border border-border bg-background px-2 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                                  />
                                </div>
                              )}
                              {/* Plan ID for subscribers */}
                              {i === 0 && (
                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-medium text-muted-foreground">plan_id</label>
                                  <input
                                    type="text"
                                    placeholder="optional"
                                    value={simulatorParams.planId}
                                    onChange={(e) => setSimulatorParams((p) => ({ ...p, planId: e.target.value }))}
                                    className="h-7 w-28 rounded border border-border bg-background px-2 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                                  />
                                </div>
                              )}
                              {/* Page/limit for paginated endpoints */}
                              {(i === 0 || i === 1) && (
                                <>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-medium text-muted-foreground">page</label>
                                    <input
                                      type="number"
                                      min="1"
                                      placeholder="1"
                                      value={simulatorParams.page}
                                      onChange={(e) => setSimulatorParams((p) => ({ ...p, page: e.target.value }))}
                                      className="h-7 w-14 rounded border border-border bg-background px-2 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-medium text-muted-foreground">limit <span className="text-muted-foreground/50 font-normal">max 100</span></label>
                                    <input
                                      type="number"
                                      min="1"
                                      max="100"
                                      placeholder="50"
                                      value={simulatorParams.limit}
                                      onChange={(e) => setSimulatorParams((p) => ({ ...p, limit: e.target.value }))}
                                      className="h-7 w-14 rounded border border-border bg-background px-2 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                  </div>
                                </>
                              )}
                              <Button
                                size="sm"
                                className="h-7 text-[11px] gap-1.5 px-3"
                                onClick={() => handleTryEndpoint(i)}
                                disabled={simulatorResult.loading || !address}
                              >
                                {simulatorResult.loading ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                                {simulatorResult.loading ? 'Running...' : 'Send Request'}
                              </Button>
                            </div>

                            {/* Pagination hint */}
                            {(i === 0 || i === 1) && !simulatorResult.loading && simulatorResult.status === null && (
                              <p className="text-[10px] text-muted-foreground/60">
                                Default: 50 results per page. Max: 100. Response includes <code className="bg-muted/50 px-0.5 rounded">total</code> for pagination.
                              </p>
                            )}

                            {/* Loading hint */}
                            {simulatorResult.loading && ep.auth === 'key' && (
                              <p className="text-[10px] text-muted-foreground">
                                Creating temp API key, fetching data, then revoking key... (2 wallet signatures)
                              </p>
                            )}

                            {/* Error */}
                            {simulatorResult.error && (
                              <div className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
                                {simulatorResult.error}
                              </div>
                            )}

                            {/* Response */}
                            {simulatorResult.status !== null && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                                      simulatorResult.status >= 200 && simulatorResult.status < 300
                                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                                        : simulatorResult.status >= 400
                                        ? 'border-red-500/30 bg-red-500/10 text-red-700'
                                        : 'border-amber-500/30 bg-amber-500/10 text-amber-700'
                                    }`}
                                  >
                                    {simulatorResult.status}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {simulatorResult.status >= 200 && simulatorResult.status < 300 ? 'OK' : 'Error'}
                                  </span>
                                </div>
                                {simulatorResult.csvBlob ? (
                                  <button
                                    onClick={handleDownloadCsv}
                                    className="inline-flex items-center gap-1.5 rounded border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-500/20 transition-colors"
                                  >
                                    <Download className="h-3 w-3" />
                                    Download CSV
                                  </button>
                                ) : simulatorResult.body !== null ? (
                                  <pre className="max-h-64 overflow-auto rounded border border-border/50 bg-background p-3 text-[10px] font-mono leading-relaxed text-foreground">
                                    {simulatorResult.body}
                                  </pre>
                                ) : null}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>

              {/* Right sidebar — Reference Notes */}
              <div className="w-48 flex-shrink-0 hidden lg:flex flex-col gap-4 border-l border-border/30 pl-4 self-start sticky top-4">
                {/* Auth */}
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold text-foreground/50 uppercase tracking-[0.15em]">Auth</p>
                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <span className="inline-flex items-center rounded border border-violet-500/20 bg-violet-500/10 text-violet-700 px-1.5 py-0.5 text-[9px] font-semibold leading-tight">API Key</span>
                      <p className="text-[11px] text-muted-foreground leading-snug">Via <code className="text-[10px] bg-muted/70 px-1 py-px rounded font-mono">X-API-Key</code> header</p>
                    </div>
                    <div className="space-y-1">
                      <span className="inline-flex items-center rounded border border-amber-500/20 bg-amber-500/10 text-amber-700 px-1.5 py-0.5 text-[9px] font-semibold leading-tight">Signature</span>
                      <p className="text-[11px] text-muted-foreground leading-snug">EIP-191 via <code className="text-[10px] bg-muted/70 px-1 py-px rounded font-mono">X-Address</code> <code className="text-[10px] bg-muted/70 px-1 py-px rounded font-mono">X-Signature</code> <code className="text-[10px] bg-muted/70 px-1 py-px rounded font-mono">X-Nonce</code></p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/20" />

                {/* Pagination */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-foreground/50 uppercase tracking-[0.15em]">Pagination</p>
                  <div className="text-[11px] text-muted-foreground leading-snug space-y-1.5">
                    <p><code className="text-[10px] bg-muted/70 px-1 py-px rounded font-mono">page</code> &amp; <code className="text-[10px] bg-muted/70 px-1 py-px rounded font-mono">limit</code> params</p>
                    <p className="text-muted-foreground/60">Default 50 &middot; Max 100</p>
                    <p>Returns <code className="text-[10px] bg-muted/70 px-1 py-px rounded font-mono">total</code> <code className="text-[10px] bg-muted/70 px-1 py-px rounded font-mono">page</code> <code className="text-[10px] bg-muted/70 px-1 py-px rounded font-mono">limit</code></p>
                  </div>
                </div>
              </div>
            </div>
            </CardContent>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="keys">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-2 rounded-lg bg-blue-500/5 border border-blue-500/10 px-3 py-2.5">
                <Info className="h-3.5 w-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700/80">
                  API keys provide programmatic read access to your merchant data (subscribers, charges, reports).
                  Use them in Discord bots, CRM integrations, or any server-side automation.
                </p>
              </div>

              {/* Create Key */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label="Label (optional)"
                    placeholder="e.g. Discord Bot, CRM Sync"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 h-9"
                  onClick={handleCreateKey}
                  disabled={creating || !address}
                >
                  {creating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Create Key
                </Button>
              </div>

              {/* Newly Created Key (shown once) */}
              {newKey && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs font-medium text-amber-700">
                      Save this key now — it won't be shown again
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-background border border-border px-3 py-2.5 text-xs font-mono break-all text-foreground">
                      {showNewKey ? newKey : newKey.slice(0, 12) + '•'.repeat(40)}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => setShowNewKey((v) => !v)}
                    >
                      {showNewKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => handleCopy(newKey, setCopiedKey)}
                    >
                      {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Use this key in the <code className="bg-muted/50 px-1 py-0.5 rounded">X-API-Key</code> header when calling read endpoints.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setNewKey(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              )}

              {/* Error */}
              {keysError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
                  {keysError}
                </div>
              )}

              {/* Keys List */}
              {keysLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-8">
                  <KeyRound className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No API keys yet. Create one to get started.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Key</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Label</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Created</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Last Used</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiKeys.map((key) => (
                        <tr key={key.id} className="border-t border-border/30">
                          <td className="px-3 py-2 font-mono text-muted-foreground">{key.keyPrefix}</td>
                          <td className="px-3 py-2 text-foreground">{key.label || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{formatDate(key.createdAt)}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleRevokeKey(key.id)}
                              disabled={revokingId === key.id}
                            >
                              {revokingId === key.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
            <CardContent className="p-5 space-y-6">
              {/* Section 1: Available Events */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3">Available Events</h3>
                <div className="space-y-1.5">
                  {([
                    ['charge.succeeded', 'Payment collected successfully'],
                    ['charge.failed', 'Payment attempt failed (balance/allowance)'],
                    ['policy.created', 'New subscription created'],
                    ['policy.revoked', 'Subscriber cancelled'],
                    ['policy.cancelled_by_failure', 'Auto-cancelled after 3 consecutive failures'],
                    ['policy.completed', 'Spending cap reached, policy complete'],
                  ] as const).map(([event, desc]) => (
                    <div key={event} className="flex items-start gap-2 text-xs">
                      <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded shrink-0">{event}</code>
                      <span className="text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t" />

              {/* Section 2: Webhook URL Configuration */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3">Webhook URL</h3>

                {webhookError && (
                  <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded mb-3">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {webhookError}
                  </div>
                )}

                {webhookLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading webhook configuration...
                  </div>
                ) : webhookConfig?.webhookUrl && !webhookEditing ? (
                  /* Configured state */
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1 truncate">{webhookConfig.webhookUrl}</code>
                      <Button variant="outline" size="sm" onClick={() => { setWebhookEditing(true); setWebhookUrlInput(webhookConfig.webhookUrl || '') }}>
                        Edit
                      </Button>
                      {confirmRemove ? (
                        <div className="flex items-center gap-1.5">
                          <Button variant="destructive" size="sm" onClick={handleRemoveWebhook} disabled={removingWebhook}>
                            {removingWebhook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setConfirmRemove(false)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setConfirmRemove(true)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Input state (no webhook or editing) */
                  <div className="space-y-2">
                    <Input
                      placeholder="https://your-server.com/webhooks/autopay"
                      value={webhookUrlInput}
                      onChange={(e) => setWebhookUrlInput(e.target.value)}
                      className="text-xs font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">Must use HTTPS (or http://localhost for development)</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={handleSaveWebhook} disabled={webhookSaving || !webhookUrlInput.trim()}>
                        {webhookSaving ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Saving...</>
                        ) : 'Save'}
                      </Button>
                      {webhookEditing && (
                        <Button variant="outline" size="sm" onClick={() => { setWebhookEditing(false); setWebhookUrlInput(webhookConfig?.webhookUrl || '') }}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Shown secret (after first save or rotate) */}
              {shownSecret && (
                <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <p className="text-xs font-medium text-amber-600">Save this secret — it won't be shown again</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1 break-all select-all">{shownSecret}</code>
                    <Button variant="outline" size="sm" onClick={() => copySecret(shownSecret)}>
                      {copiedSecret ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Section 3: Signing Secret */}
              {webhookConfig?.webhookUrl && webhookConfig.hasSecret && (
                <>
                  <div className="border-t" />
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-3">Signing Secret</h3>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-green-500" />
                        Secret configured
                      </div>
                      {confirmRotate ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Generate new secret?</span>
                          <Button variant="destructive" size="sm" onClick={handleRotateSecret} disabled={rotatingSecret}>
                            {rotatingSecret ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setConfirmRotate(false)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setConfirmRotate(true)}>
                          <RotateCw className="h-3.5 w-3.5 mr-1.5" />
                          Rotate Secret
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Payload Example (collapsible) */}
              <div className="border-t" />
              <div>
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
                  onClick={() => setShowPayloadExample(!showPayloadExample)}
                >
                  {showPayloadExample ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  Example Payload
                </button>
                {showPayloadExample && (
                  <pre className="mt-3 text-[11px] font-mono bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre">{`{
  "event": "charge.succeeded",
  "timestamp": "2026-02-25T12:00:00.000Z",
  "data": {
    "policyId": "0xabc123...",
    "chainId": 747,
    "payer": "0x1234...abcd",
    "merchant": "0x5678...ef01",
    "amount": "15.00",
    "protocolFee": "0.375",
    "txHash": "0xdef456..."
  }
}`}</pre>
                )}
              </div>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}
