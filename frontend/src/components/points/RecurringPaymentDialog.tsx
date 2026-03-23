import { useState, useEffect } from 'react'
import { parseUnits } from 'viem'
import { Button } from '../ui/button'
import { X, Loader2, Check, AlertCircle } from 'lucide-react'
import { useCreatePolicy } from '../../hooks/useCreatePolicy'
import { useApproval } from '../../hooks/useApproval'
import { useDisplayName } from '../../hooks/useEns'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const mainnetClient = createPublicClient({ chain: mainnet, transport: http() })

const INTERVALS = [
  { label: 'Daily', seconds: 86400 },
  { label: 'Weekly', seconds: 604800 },
  { label: 'Monthly', seconds: 2592000 },
  { label: 'Quarterly', seconds: 7776000 },
  { label: 'Yearly', seconds: 31536000 },
]

interface RecurringPaymentDialogProps {
  recipientAddress: string
  onClose: () => void
}

export function RecurringPaymentDialog({ recipientAddress, onClose }: RecurringPaymentDialogProps) {
  const { displayName: recipientName, isEns: recipientHasEns } = useDisplayName(recipientAddress)
  const { createPolicy, error: createError } = useCreatePolicy()
  const { approve, isApproved, isLoading: approvalLoading } = useApproval()

  const [amount, setAmount] = useState('5')
  const [interval, setInterval] = useState(2592000) // monthly
  const [cap, setCap] = useState('')
  const [step, setStep] = useState<'form' | 'approving' | 'creating' | 'done'>('form')
  const [error, setError] = useState<string | null>(null)

  // ENS resolution for manual recipient input
  const [recipientInput, setRecipientInput] = useState(recipientAddress)
  const [resolvedAddress, setResolvedAddress] = useState(recipientAddress)
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    setRecipientInput(recipientAddress)
    setResolvedAddress(recipientAddress)
  }, [recipientAddress])

  // Resolve ENS when input changes
  useEffect(() => {
    const input = recipientInput.trim()
    if (input.startsWith('0x') && input.length === 42) {
      setResolvedAddress(input)
      return
    }
    if (input.endsWith('.eth')) {
      setResolving(true)
      mainnetClient.getEnsAddress({ name: input })
        .then((addr) => {
          setResolvedAddress(addr || '')
          setResolving(false)
        })
        .catch(() => {
          setResolvedAddress('')
          setResolving(false)
        })
    }
  }, [recipientInput])

  const handleSubmit = async () => {
    setError(null)

    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Enter a valid amount')
      return
    }

    if (!resolvedAddress || !resolvedAddress.startsWith('0x')) {
      setError('Invalid recipient address')
      return
    }

    const chargeAmount = parseUnits(amount, 6)
    const spendingCap = cap ? parseUnits(cap, 6) : BigInt(0) // 0 = unlimited

    try {
      // Step 1: Ensure USDC approval
      if (!isApproved(chargeAmount)) {
        setStep('approving')
        await approve(chargeAmount)
      }

      // Step 2: Create policy
      setStep('creating')
      await createPolicy({
        merchant: resolvedAddress as `0x${string}`,
        chargeAmount,
        interval,
        spendingCap,
        metadataUrl: '',
      })

      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create subscription')
      setStep('form')
    }
  }

  const isProcessing = step === 'approving' || step === 'creating' || approvalLoading

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-background rounded-2xl shadow-2xl border border-border/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
          <h3 className="text-sm font-semibold">Set Up Recurring Payment</h3>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {step === 'done' ? (
            // Success
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm font-medium mb-1">Subscription Created</p>
              <p className="text-xs text-muted-foreground mb-4">
                Recurring payment of ${amount} USDC to {recipientHasEns ? recipientName : `${resolvedAddress.slice(0, 6)}...${resolvedAddress.slice(-4)}`}
              </p>
              <Button onClick={onClose} variant="outline" size="sm">Done</Button>
            </div>
          ) : (
            <>
              {/* Recipient */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Recipient</label>
                <input
                  type="text"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  placeholder="0x... or name.eth"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                {resolving && <p className="text-[11px] text-muted-foreground mt-1">Resolving ENS...</p>}
                {!resolving && recipientInput.endsWith('.eth') && resolvedAddress && (
                  <p className="text-[11px] text-green-600 mt-1 font-mono">{resolvedAddress.slice(0, 6)}...{resolvedAddress.slice(-4)}</p>
                )}
                {!resolving && recipientInput.endsWith('.eth') && !resolvedAddress && (
                  <p className="text-[11px] text-destructive mt-1">ENS name not found</p>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Amount (USDC)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0.01"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Interval */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Frequency</label>
                <div className="flex gap-1.5 flex-wrap">
                  {INTERVALS.map((i) => (
                    <button
                      key={i.seconds}
                      onClick={() => setInterval(i.seconds)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        interval === i.seconds
                          ? 'bg-primary text-white'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {i.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Spending Cap (optional) */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Spending Cap (USDC) <span className="text-muted-foreground/60">— optional, 0 = unlimited</span>
                </label>
                <input
                  type="number"
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Summary */}
              <div className="rounded-lg bg-muted/30 border border-border/30 px-3 py-2.5 text-xs text-muted-foreground">
                Pay <span className="font-semibold text-foreground">${amount} USDC</span>{' '}
                {INTERVALS.find(i => i.seconds === interval)?.label.toLowerCase()} to{' '}
                <span className="font-medium text-foreground">{recipientHasEns ? recipientName : `${resolvedAddress.slice(0, 6)}...${resolvedAddress.slice(-4)}`}</span>
                {cap ? ` (max $${cap} total)` : ''}
                . First charge is immediate.
              </div>

              {/* Error */}
              {(error || createError) && (
                <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{error || createError}</span>
                </div>
              )}

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={isProcessing || !amount || !resolvedAddress}
                className="w-full"
              >
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {step === 'approving' ? 'Approving USDC...' : 'Creating subscription...'}</>
                ) : (
                  `Subscribe — $${amount}/` + (INTERVALS.find(i => i.seconds === interval)?.label.toLowerCase() || 'month')
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
