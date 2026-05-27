import * as React from 'react'
import { parseUnits } from 'viem'
import { useTransfer, useChain } from '../../hooks'
import { useCreatePolicy } from '../../hooks/useCreatePolicy'
import { useApproval } from '../../hooks/useApproval'
import { isTempoBuild } from '../../contexts/TempoWalletContext'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card'
import { StatusMessage } from '../common/StatusMessage'
import { Send, CheckCircle, Loader2, ExternalLink, Repeat, ArrowLeft } from 'lucide-react'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const mainnetClient = createPublicClient({ chain: mainnet, transport: http() })

const INTERVALS = [
  { label: 'Daily', seconds: 86400 },
  { label: 'Weekly', seconds: 604800 },
  { label: 'Monthly', seconds: 2592000 },
  { label: 'Yearly', seconds: 31536000 },
]

interface SendUSDCProps {
  compact?: boolean
  inline?: boolean
}

/** ENS-resolving recipient input — shows resolved address below */
function RecipientInput({ value, onChange, className = '' }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [resolvedAddress, setResolvedAddress] = React.useState<string | null>(null)
  const [resolving, setResolving] = React.useState(false)

  React.useEffect(() => {
    const v = value.trim()
    if (v.startsWith('0x') && v.length === 42) {
      setResolvedAddress(v)
      return
    }
    if (v.endsWith('.eth') && v.length > 4) {
      setResolving(true)
      mainnetClient.getEnsAddress({ name: v })
        .then((addr) => { setResolvedAddress(addr ?? null); setResolving(false) })
        .catch(() => { setResolvedAddress(null); setResolving(false) })
    } else {
      setResolvedAddress(null)
    }
  }, [value])

  return (
    <div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Recipient (0x... or name.eth)"
        className={className}
      />
      {resolving && <p className="text-[10px] text-muted-foreground mt-0.5 px-1">Resolving ENS...</p>}
      {!resolving && value.endsWith('.eth') && resolvedAddress && (
        <p className="text-[10px] text-green-600 mt-0.5 px-1 font-mono">{resolvedAddress.slice(0, 6)}...{resolvedAddress.slice(-4)}</p>
      )}
      {!resolving && value.endsWith('.eth') && value.length > 4 && !resolvedAddress && (
        <p className="text-[10px] text-destructive mt-0.5 px-1">ENS name not found</p>
      )}
    </div>
  )
}

/** Resolve ENS or return raw address */
async function resolveRecipient(input: string): Promise<string | null> {
  const v = input.trim()
  if (v.startsWith('0x') && v.length === 42) return v
  if (v.endsWith('.eth')) {
    const addr = await mainnetClient.getEnsAddress({ name: v }).catch(() => null)
    return addr ?? null
  }
  return null
}

export function SendUSDC({ compact = false, inline = false }: SendUSDCProps) {
  const { hash, status, isLoading, sendUSDC } = useTransfer()
  const { chainConfig } = useChain()
  const [to, setTo] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [mode, setMode] = React.useState<'send' | 'recurring'>('send')

  // Recurring payment state
  const [interval, setInterval] = React.useState(2592000) // monthly
  const [cap, setCap] = React.useState('')
  const { createPolicy, error: policyError } = useCreatePolicy()
  const { approve, isApproved } = useApproval()
  const [recurringStep, setRecurringStep] = React.useState<'form' | 'approving' | 'creating' | 'done'>('form')
  const [recurringError, setRecurringError] = React.useState<string | null>(null)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const resolved = await resolveRecipient(to)
    if (!resolved || !amount) return
    await sendUSDC(resolved as `0x${string}`, amount)
  }

  const handleRecurring = async (e: React.FormEvent) => {
    e.preventDefault()
    setRecurringError(null)

    const resolved = await resolveRecipient(to)
    if (!resolved) { setRecurringError('Invalid recipient'); return }

    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || parsedAmount <= 0) { setRecurringError('Enter a valid amount'); return }

    const chargeAmount = parseUnits(amount, 6)
    const spendingCap = cap ? parseUnits(cap, 6) : 0n

    try {
      // On Tempo, approval is handled server-side — skip client-side approval check
      if (!isTempoBuild() && !isApproved(chargeAmount)) {
        setRecurringStep('approving')
        await approve(chargeAmount)
      }
      setRecurringStep('creating')
      await createPolicy({
        merchant: resolved as `0x${string}`,
        chargeAmount,
        interval,
        spendingCap,
        metadataUrl: '',
      })
      setRecurringStep('done')
    } catch (err) {
      setRecurringError(err instanceof Error ? err.message : 'Failed')
      setRecurringStep('form')
    }
  }

  const isRecurringProcessing = recurringStep === 'approving' || recurringStep === 'creating'
  const intervalLabel = INTERVALS.find(i => i.seconds === interval)?.label.toLowerCase() || 'month'

  // ── Compact layout (dashboard) ──────────────────────────────

  if (compact) {
    return (
      <Card>
        <CardHeader className="py-2.5 md:py-3.5 px-3.5 md:px-5 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 md:h-8 md:w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-indigo-500/5">
                {mode === 'send' ? <Send className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" /> : <Repeat className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />}
              </div>
              <CardTitle className="text-[14px] md:text-[15px] font-semibold">
                {mode === 'send' ? 'Send USDC' : 'Recurring Payment'}
              </CardTitle>
            </div>
            <button
              onClick={() => { setMode(mode === 'send' ? 'recurring' : 'send'); setRecurringStep('form'); setRecurringError(null) }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all active:scale-95 bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 hover:border-primary/30"
            >
              {mode === 'send' ? <><Repeat className="h-3 w-3" /> Recurring</> : <><ArrowLeft className="h-3 w-3" /> One-time</>}
            </button>
          </div>
        </CardHeader>
        <CardContent className="px-3.5 md:px-5 pb-3 md:pb-5 pt-3 md:pt-4">
          {mode === 'send' ? (
            <>
              <form onSubmit={handleSend} className="space-y-2 md:space-y-3">
                <RecipientInput value={to} onChange={setTo} className="h-8 md:h-9 text-[13px] md:text-sm" />
                <div className="flex gap-2">
                  <Input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    type="number"
                    step="0.000001"
                    className="h-8 md:h-9 text-[13px] md:text-sm flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={isLoading || !to || !amount}
                    className="h-8 md:h-9 px-4 text-[13px] md:text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/20 flex-shrink-0"
                    size="sm"
                  >
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  </Button>
                </div>
              </form>
              {status && <StatusMessage message={status} className="mt-2 text-xs" />}
              {hash && (
                <div className="mt-3 p-2.5 bg-success/10 border border-success/20 rounded-lg text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-success">
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span className="font-medium">Confirmed</span>
                    </div>
                    <a href={`${chainConfig.explorer}/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline font-medium">
                      View tx <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}
            </>
          ) : recurringStep === 'done' ? (
            <div className="text-center py-4">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium mb-1">Subscription Created</p>
              <p className="text-xs text-muted-foreground mb-3">${amount}/{intervalLabel} to {to.endsWith('.eth') ? to : `${to.slice(0, 6)}...${to.slice(-4)}`}</p>
              <Button variant="outline" size="sm" onClick={() => { setRecurringStep('form'); setTo(''); setAmount(''); setCap('') }}>New Payment</Button>
            </div>
          ) : (
            <>
              <form onSubmit={handleRecurring} className="space-y-2 md:space-y-3">
                <RecipientInput value={to} onChange={setTo} className="h-8 md:h-9 text-[13px] md:text-sm" />
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Amount (USDC)"
                    type="number"
                    step="0.01"
                    className="h-8 md:h-9 text-[13px] md:text-sm"
                  />
                  <Input
                    value={cap}
                    onChange={(e) => setCap(e.target.value)}
                    placeholder="Cap"
                    type="number"
                    step="1"
                    title="Spending cap in USDC (0 or empty = unlimited)"
                    className="h-8 md:h-9 text-[13px] md:text-sm w-20 md:w-24"
                  />
                </div>
                <div className="flex gap-1.5">
                  {INTERVALS.map((i) => (
                    <button
                      key={i.seconds}
                      type="button"
                      onClick={() => setInterval(i.seconds)}
                      className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                        interval === i.seconds ? 'bg-primary text-white shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {i.label}
                    </button>
                  ))}
                </div>
                {amount && to && (
                  <p className="text-[11px] text-muted-foreground px-0.5">
                    ${amount}/{intervalLabel}{cap ? ` (max $${cap})` : ''}. First charge is immediate.
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={isRecurringProcessing || !to || !amount}
                  className="w-full h-8 md:h-9 text-[13px] md:text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  size="sm"
                >
                  {isRecurringProcessing ? (
                    <><Loader2 className="h-3 w-3 animate-spin mr-1" /> {recurringStep === 'approving' ? 'Approving...' : 'Creating...'}</>
                  ) : (
                    <><Repeat className="h-3 w-3 mr-1" /> Pay</>
                  )}
                </Button>
              </form>
              {(recurringError || policyError) && (
                <p className="text-[11px] text-destructive mt-2">{recurringError || policyError}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── Inline layout ──────────────────────────────────────────

  if (inline) {
    return (
      <div>
        <form onSubmit={handleSend} className="space-y-3">
          <RecipientInput value={to} onChange={setTo} className="h-10 text-sm" />
          <div className="flex gap-2">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" type="number" step="0.000001" className="h-10 text-sm flex-1" />
            <Button type="submit" disabled={isLoading || !to || !amount} className="h-10 px-5 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/20 flex-shrink-0">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
        {status && <StatusMessage message={status} className="mt-3 text-xs" />}
        {hash && (
          <div className="mt-3 p-3 bg-success/10 border border-success/20 rounded-xl text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-success"><CheckCircle className="h-3.5 w-3.5" /><span className="font-medium">Confirmed</span></div>
              <a href={`${chainConfig.explorer}/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline font-medium">View tx <ExternalLink className="h-3 w-3" /></a>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Full layout ────────────────────────────────────────────

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-indigo-500/5">
            <Send className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-lg">Send USDC</CardTitle>
        </div>
        <CardDescription>Transfer USDC to another address</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSend} className="space-y-4">
          <RecipientInput value={to} onChange={setTo} />
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" label="Amount (USDC)" type="number" step="0.000001" />
          <Button type="submit" disabled={isLoading || !to || !amount} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/20">
            {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</> : <><Send className="h-4 w-4 mr-2" />Send USDC</>}
          </Button>
        </form>
        <StatusMessage message={status} />
        {hash && (
          <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-success"><CheckCircle className="h-4 w-4" /><span className="font-medium">Transaction Confirmed</span></div>
              <a href={`${chainConfig.explorer}/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">View on Explorer <ExternalLink className="h-3 w-3" /></a>
            </div>
            <code className="text-xs font-mono break-all">{hash}</code>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
