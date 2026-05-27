import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { useAddress } from '../../hooks/useAddress'
import { useChain } from '../../contexts/ChainContext'
import { PolicyManagerAbi } from '../../config/deployments'
import { useSetMerchantFee } from '../../hooks/useSetMerchantFee'
import { Loader2, Check, AlertTriangle, ShieldCheck, Plus, Trash2, Percent } from 'lucide-react'

interface FeeEntry {
  merchant: string
  feeBps: string
  saved: boolean
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function AdminFeesPage() {
  const address = useAddress()
  const { publicClient, chainConfig } = useChain()
  const { setMerchantFee, isLoading: isSending, status, error, reset } = useSetMerchantFee()

  const [isOwner, setIsOwner] = React.useState<boolean | null>(null)
  const [isCheckingOwner, setIsCheckingOwner] = React.useState(true)
  const [entries, setEntries] = React.useState<FeeEntry[]>([])
  const [newMerchant, setNewMerchant] = React.useState('')
  const [newFeeBps, setNewFeeBps] = React.useState('')
  const [pendingIndex, setPendingIndex] = React.useState<number | null>(null)
  const [successIndex, setSuccessIndex] = React.useState<number | null>(null)

  React.useEffect(() => {
    async function checkOwner() {
      if (!publicClient || !address || !chainConfig.policyManager) {
        setIsOwner(false)
        setIsCheckingOwner(false)
        return
      }

      try {
        const owner = await publicClient.readContract({
          address: chainConfig.policyManager,
          abi: PolicyManagerAbi,
          functionName: 'owner',
        }) as `0x${string}`

        setIsOwner(owner.toLowerCase() === address.toLowerCase())
      } catch {
        setIsOwner(false)
      } finally {
        setIsCheckingOwner(false)
      }
    }

    checkOwner()
  }, [publicClient, address, chainConfig.policyManager])

  const defaultFeeBps = 250

  const handleAdd = () => {
    const trimmed = newMerchant.trim()
    if (!trimmed || !trimmed.startsWith('0x') || trimmed.length !== 42) return

    const bps = parseInt(newFeeBps, 10)
    if (isNaN(bps) || bps < 0 || bps > defaultFeeBps) return

    if (entries.some((e) => e.merchant.toLowerCase() === trimmed.toLowerCase())) return

    setEntries([...entries, { merchant: trimmed, feeBps: newFeeBps, saved: false }])
    setNewMerchant('')
    setNewFeeBps('')
  }

  const handleRemove = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index))
  }

  const handleSave = async (index: number) => {
    const entry = entries[index]
    if (!entry) return

    const bps = parseInt(entry.feeBps, 10)
    if (isNaN(bps) || bps < 0 || bps > defaultFeeBps) return

    setPendingIndex(index)
    setSuccessIndex(null)
    reset()

    try {
      await setMerchantFee(entry.merchant as `0x${string}`, bps)
      setEntries((prev) =>
        prev.map((e, i) => (i === index ? { ...e, saved: true } : e))
      )
      setSuccessIndex(index)
      setTimeout(() => setSuccessIndex(null), 3000)
    } catch {
      // error state handled by hook
    } finally {
      setPendingIndex(null)
    }
  }

  const handleUpdateFeeBps = (index: number, value: string) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, feeBps: value, saved: false } : e))
    )
  }

  if (isCheckingOwner) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
            <p className="font-medium">Access Denied</p>
            <p className="text-sm text-muted-foreground">
              Only the contract owner can manage merchant fees.
            </p>
            {address && (
              <p className="text-xs text-muted-foreground font-mono">
                Connected: {truncateAddress(address)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const isValidNewEntry =
    newMerchant.trim().startsWith('0x') &&
    newMerchant.trim().length === 42 &&
    newFeeBps !== '' &&
    !isNaN(parseInt(newFeeBps, 10)) &&
    parseInt(newFeeBps, 10) >= 0 &&
    parseInt(newFeeBps, 10) <= defaultFeeBps &&
    !entries.some((e) => e.merchant.toLowerCase() === newMerchant.trim().toLowerCase())

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold">Merchant Fee Management</h1>
          <p className="text-sm text-muted-foreground">
            Set custom protocol fee rates for individual merchants. Default rate: {defaultFeeBps / 100}%
          </p>
        </div>
      </div>

      {/* Add new merchant fee */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Add Merchant Fee Override</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="Merchant Address"
                placeholder="0x..."
                value={newMerchant}
                onChange={(e) => setNewMerchant(e.target.value)}
              />
            </div>
            <div className="w-32">
              <Input
                label="Fee (bps)"
                placeholder="e.g. 50"
                value={newFeeBps}
                onChange={(e) => setNewFeeBps(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!isValidNewEntry}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            1 bps = 0.01%. Range: 0 (free) to {defaultFeeBps} ({defaultFeeBps / 100}%). Example: 50 bps = 0.5%
          </p>
        </CardContent>
      </Card>

      {/* Merchant fee list */}
      {entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Fee Overrides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {entries.map((entry, index) => {
                const bps = parseInt(entry.feeBps, 10)
                const pct = isNaN(bps) ? '—' : `${(bps / 100).toFixed(2)}%`
                const isPending = pendingIndex === index
                const isSuccess = successIndex === index
                const isError = pendingIndex === null && error && !isSending && index === entries.findIndex((e) => !e.saved)

                return (
                  <div key={entry.merchant} className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono truncate">{entry.merchant}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          <Percent className="h-3 w-3 mr-1" />
                          {pct}
                        </Badge>
                        <span className="text-xs text-muted-foreground">({bps} bps)</span>
                        {entry.saved && !isSuccess && (
                          <Badge variant="outline" className="text-xs text-green-600">On-chain</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-20">
                        <Input
                          placeholder="bps"
                          value={entry.feeBps}
                          onChange={(e) => handleUpdateFeeBps(index, e.target.value)}
                          disabled={isPending}
                        />
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleSave(index)}
                        disabled={isPending || isSending}
                      >
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isSuccess ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          'Save'
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemove(index)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status feedback */}
      {(status || error) && (
        <Card>
          <CardContent className="pt-4">
            {error ? (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{status}</p>
            )}
          </CardContent>
        </Card>
      )}

      {entries.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No merchant fee overrides configured. All merchants use the default {defaultFeeBps / 100}% rate.
        </div>
      )}
    </div>
  )
}
