import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Copy, Check, Loader2, Link2, RefreshCw } from 'lucide-react'
import { getCustomRelayerConfig, createCheckoutLink } from '../../lib/relayer'
import type { PlanSummary } from '../../lib/relayer'

type FieldKey = 'email' | 'name' | 'discord' | 'telegram' | 'twitter' | 'mobile'
type FieldState = 'off' | 'optional' | 'required'

const FIELD_LABELS: Record<FieldKey, string> = {
  email: 'Email',
  name: 'Name',
  discord: 'Discord',
  telegram: 'Telegram',
  twitter: 'X / Twitter',
  mobile: 'Mobile',
}

const ALL_FIELDS: FieldKey[] = ['email', 'name', 'discord', 'telegram', 'twitter', 'mobile']

const INTERVAL_MAP: Record<string, number> = {
  seconds: 1, minutes: 60, daily: 86400,
  weekly: 604800, biweekly: 1209600, monthly: 2592000,
  quarterly: 7776000, yearly: 31536000,
}

interface PaymentLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: PlanSummary
  merchantAddress: string
  signMessage: (args: { message: string }) => Promise<`0x${string}`>
}

export function PaymentLinkDialog({ open, onOpenChange, plan, merchantAddress, signMessage }: PaymentLinkDialogProps) {
  const [fields, setFields] = React.useState<Record<FieldKey, FieldState>>(() => {
    const initial: Record<FieldKey, FieldState> = {} as Record<FieldKey, FieldState>
    for (const key of ALL_FIELDS) initial[key] = 'off'
    return initial
  })
  const [copied, setCopied] = React.useState(false)
  const [copiedShort, setCopiedShort] = React.useState(false)
  const [copiedBadge, setCopiedBadge] = React.useState(false)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [generateError, setGenerateError] = React.useState<string | null>(null)
  const [shortUrl, setShortUrl] = React.useState<string | null>(null)
  const [shortUrlFieldsKey, setShortUrlFieldsKey] = React.useState<string | null>(null)
  const [slug, setSlug] = React.useState('')

  const cycleField = (key: FieldKey) => {
    setFields((prev) => {
      const next = { ...prev }
      const order: FieldState[] = ['off', 'optional', 'required']
      const currentIdx = order.indexOf(prev[key])
      next[key] = order[(currentIdx + 1) % order.length]
      return next
    })
  }

  const checkoutUrl = React.useMemo(() => {
    const baseUrl = window.location.origin

    const intervalSeconds = plan.intervalLabel ? (INTERVAL_MAP[plan.intervalLabel] ?? 2592000) : 2592000
    const relayerUrl = getCustomRelayerConfig(merchantAddress)?.url
      || import.meta.env.VITE_RELAYER_URL
      || ''

    const params = new URLSearchParams()
    params.set('merchant', merchantAddress)
    params.set('metadata_url', `${relayerUrl}/metadata/${merchantAddress.toLowerCase()}/${plan.id}`)
    params.set('amount', plan.amount != null ? String(plan.amount) : '0')
    params.set('interval', String(intervalSeconds))
    if (plan.spendingCap != null && plan.spendingCap > 0) {
      params.set('spending_cap', String(plan.spendingCap))
    }
    if (plan.ipfsCid) {
      params.set('ipfs_metadata_url', `https://w3s.link/ipfs/${plan.ipfsCid}`)
    }
    params.set('success_url', `${baseUrl}/dashboard`)
    params.set('cancel_url', `${baseUrl}/dashboard`)

    const fieldParts: string[] = []
    for (const key of ALL_FIELDS) {
      if (fields[key] === 'required') fieldParts.push(`${key}:r`)
      else if (fields[key] === 'optional') fieldParts.push(`${key}:o`)
    }
    if (fieldParts.length > 0) {
      params.set('fields', fieldParts.join(','))
    }

    return `${baseUrl}/checkout?${params.toString()}`
  }, [plan, merchantAddress, fields])

  const currentFieldsKey = React.useMemo(() => {
    const parts: string[] = []
    for (const key of ALL_FIELDS) {
      if (fields[key] === 'required') parts.push(`${key}:r`)
      else if (fields[key] === 'optional') parts.push(`${key}:o`)
    }
    return parts.join(',')
  }, [fields])

  // Invalidate cached short URL when fields change
  React.useEffect(() => {
    if (shortUrl && shortUrlFieldsKey !== currentFieldsKey) {
      setShortUrl(null)
      setShortUrlFieldsKey(null)
    }
  }, [currentFieldsKey, shortUrl, shortUrlFieldsKey])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(checkoutUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleGenerateShortLink = async () => {
    // If we already have a short link for this config, just copy it
    if (shortUrl && shortUrlFieldsKey === currentFieldsKey) {
      try {
        await navigator.clipboard.writeText(shortUrl)
        setCopiedShort(true)
        setTimeout(() => setCopiedShort(false), 2000)
      } catch { /* document not focused — user can retry */ }
      return
    }

    setGenerateError(null)
    setIsGenerating(true)
    try {
      const fieldsParam = currentFieldsKey || undefined
      const origin = window.location.origin
      const slugTrimmed = slug.trim() || undefined
      const result = await createCheckoutLink(
        merchantAddress,
        {
          planId: plan.id,
          successUrl: `${origin}/dashboard`,
          cancelUrl: `${origin}/dashboard`,
          fields: fieldsParam,
          slug: slugTrimmed,
        },
        signMessage,
      )
      setShortUrlFieldsKey(currentFieldsKey)
      // For custom relayers, append ?relayer= so the frontend knows where to resolve
      const url = result.isCustomRelayer
        ? `${origin}/pay/${result.shortId}?relayer=${encodeURIComponent(result.relayerBaseUrl)}`
        : `${origin}/pay/${result.shortId}`
      setShortUrl(url)
      // Don't auto-copy here — the signing popup steals focus so clipboard.writeText
      // throws "Document is not focused". The user can click Copy once the URL appears.
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate short link')
    } finally {
      setIsGenerating(false)
    }
  }

  // Badge uses the short URL if available, otherwise falls back to long URL
  const badgeLinkUrl = shortUrl ?? checkoutUrl
  const badgeMarkdown = `[![Sponsor with AutoPay](https://img.shields.io/badge/Sponsor_with-AutoPay-0052FF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0wIDE4Yy00LjQyIDAtOC0zLjU4LTgtOHMzLjU4LTggOC04IDggMy41OCA4IDgtMy41OCA0LTggOHoiLz48cGF0aCBkPSJNMTAgOGw2IDQtNiA0VjgiLz48L3N2Zz4=)](${badgeLinkUrl})`

  const handleCopyBadge = async () => {
    await navigator.clipboard.writeText(badgeMarkdown)
    setCopiedBadge(true)
    setTimeout(() => setCopiedBadge(false), 2000)
  }

  const randomSuffix = React.useMemo(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let s = ''
    for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)]
    return s
  }, [])

  const slugValid = !slug.trim() || /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,23}$/.test(slug.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6">
        <DialogHeader>
          <DialogTitle>{plan.planName || plan.id}</DialogTitle>
          <DialogDescription>
            ${plan.amount != null ? plan.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0'} / {plan.intervalLabel || 'month'}
          </DialogDescription>
        </DialogHeader>

        {/* Subscriber fields */}
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Subscriber Fields</p>
          <div className="grid grid-cols-2 gap-2">
            {ALL_FIELDS.map((key) => (
              <button
                key={key}
                onClick={() => cycleField(key)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors ${
                  fields[key] === 'required'
                    ? 'border-primary bg-primary/5 text-primary'
                    : fields[key] === 'optional'
                    ? 'border-amber-500/50 bg-amber-500/5 text-amber-600'
                    : 'border-border text-muted-foreground hover:border-border/80'
                }`}
              >
                <span>{FIELD_LABELS[key]}</span>
                <span className="text-[10px] font-medium uppercase">
                  {fields[key] === 'required' ? 'Required' : fields[key] === 'optional' ? 'Optional' : 'Off'}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Click to cycle: Off → Optional → Required
          </p>
        </div>

        {/* Payment Link (long URL) */}
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Payment Link</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={checkoutUrl}
              className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-foreground truncate"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        {/* Short Link */}
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Short Link</p>
          {shortUrl ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shortUrl}
                  className="flex-1 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-mono text-foreground truncate"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  onClick={handleGenerateShortLink}
                >
                  {copiedShort ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedShort ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <button
                onClick={() => { setShortUrl(null); setShortUrlFieldsKey(null) }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Generate a new link
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Slug input inline with generate button */}
              <div className="flex gap-2">
                <div className="flex-1 flex items-center rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-muted-foreground overflow-hidden">
                  <span className="shrink-0 opacity-50">/pay/</span>
                  <input
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value)
                      setShortUrl(null)
                    }}
                    placeholder="my-brand"
                    className="bg-transparent outline-none text-foreground placeholder:text-muted-foreground/40 min-w-0 flex-1"
                  />
                  <span className="shrink-0 opacity-30">-{randomSuffix}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  onClick={handleGenerateShortLink}
                  disabled={isGenerating || !slugValid}
                >
                  {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                  {isGenerating ? 'Generating...' : 'Generate'}
                </Button>
              </div>
              {!slugValid && (
                <p className="text-[10px] text-destructive">Letters, numbers, hyphens, underscores only (max 24 chars).</p>
              )}
            </div>
          )}
          {generateError && (
            <p className="text-[10px] text-destructive mt-1">{generateError}</p>
          )}
        </div>

        {/* GitHub Badge */}
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">GitHub Sponsor Badge</p>
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            {/* Preview */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Preview</span>
              <img
                src={`https://img.shields.io/badge/Sponsor_with-AutoPay-0052FF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0wIDE4Yy00LjQyIDAtOC0zLjU4LTgtOHMzLjU4LTggOC04IDggMy41OCA4IDgtMy41OCA0LTggOHoiLz48cGF0aCBkPSJNMTAgOGw2IDQtNiA0VjgiLz48L3N2Zz4=`}
                alt="Sponsor with AutoPay"
                className="h-7"
              />
            </div>
            {/* Markdown snippet */}
            <div className="flex gap-2">
              <input
                readOnly
                value={badgeMarkdown}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[10px] font-mono text-foreground truncate"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 shrink-0"
                onClick={handleCopyBadge}
              >
                {copiedBadge ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedBadge ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              Paste into your README.md — {shortUrl ? 'uses your short link.' : 'links to your checkout page.'}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
