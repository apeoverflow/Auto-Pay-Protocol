import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Copy, Check } from 'lucide-react'
import { getCustomRelayerConfig } from '../../lib/relayer'
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
}

export function PaymentLinkDialog({ open, onOpenChange, plan, merchantAddress }: PaymentLinkDialogProps) {
  const [fields, setFields] = React.useState<Record<FieldKey, FieldState>>(() => {
    const initial: Record<FieldKey, FieldState> = {} as Record<FieldKey, FieldState>
    for (const key of ALL_FIELDS) initial[key] = 'off'
    return initial
  })
  const [copied, setCopied] = React.useState(false)

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

    // Build fields param
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

  const handleCopy = async () => {
    await navigator.clipboard.writeText(checkoutUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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

        {/* Generated link */}
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
      </DialogContent>
    </Dialog>
  )
}
