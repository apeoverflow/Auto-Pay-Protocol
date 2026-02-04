import * as React from 'react'
import { formatUnits, parseUnits } from 'viem'
import { useWallet, useChain, useApproval, useCreatePolicy, usePolicies, useCharge, useRevokePolicy } from '../hooks'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import {
  Beaker,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  Copy,
  RefreshCw,
  Zap,
  XCircle,
} from 'lucide-react'
import { USDC_DECIMALS } from '../config'
import { parseContractError } from '../types/policy'
import { ToastContainer, useToast } from '../components/ui/toast'

// Interval options in seconds
const INTERVAL_OPTIONS = [
  { label: '1 hour', value: 3600 },
  { label: '1 day', value: 86400 },
  { label: '1 week', value: 604800 },
  { label: '30 days', value: 2592000 },
]

export function DemoPage() {
  const { account, balance } = useWallet()
  const { chainConfig } = useChain()
  const { policies, refetch: refetchPolicies } = usePolicies()

  // Form state
  const [merchant, setMerchant] = React.useState('')
  const [chargeAmount, setChargeAmount] = React.useState('1')
  const [interval, setInterval] = React.useState(86400)
  const [spendingCap, setSpendingCap] = React.useState('100')
  const [metadataUrl, setMetadataUrl] = React.useState('')

  // Approval hook
  const approval = useApproval(chainConfig.policyManager)

  // Create policy hook
  const createPolicy = useCreatePolicy()

  // Charge hook
  const chargeHook = useCharge()

  // Revoke hook
  const revokeHook = useRevokePolicy()

  // Track which policy is being charged/revoked
  const [chargingPolicyId, setChargingPolicyId] = React.useState<string | null>(null)
  const [revokingPolicyId, setRevokingPolicyId] = React.useState<string | null>(null)

  // Toast notifications
  const toast = useToast()

  // Calculated values
  const chargeAmountBigInt = React.useMemo(() => {
    try {
      return parseUnits(chargeAmount || '0', USDC_DECIMALS)
    } catch {
      return 0n
    }
  }, [chargeAmount])

  const spendingCapBigInt = React.useMemo(() => {
    try {
      return parseUnits(spendingCap || '0', USDC_DECIMALS)
    } catch {
      return 0n
    }
  }, [spendingCap])

  const needsApproval = !approval.isApproved(spendingCapBigInt)

  // Handle approval
  const handleApprove = async () => {
    try {
      await approval.approve(spendingCapBigInt)
    } catch (err) {
      console.error('Approval failed:', err)
    }
  }

  // Handle create subscription
  const handleCreate = async () => {
    if (!merchant) return

    try {
      await createPolicy.createPolicy({
        merchant: merchant as `0x${string}`,
        chargeAmount: chargeAmountBigInt,
        interval,
        spendingCap: spendingCapBigInt,
        metadataUrl,
      })

      // Refresh policies list
      refetchPolicies()
    } catch (err) {
      console.error('Create policy failed:', err)
    }
  }

  // Reset form after successful creation
  React.useEffect(() => {
    if (createPolicy.policyId) {
      // Keep the success state visible for a moment
    }
  }, [createPolicy.policyId])

  const [copied, setCopied] = React.useState<string | null>(null)
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  // Handle charge
  const handleCharge = async (policyId: `0x${string}`) => {
    setChargingPolicyId(policyId)
    try {
      await chargeHook.charge(policyId)
      toast.success('Charge successful')
      refetchPolicies()
    } catch (err) {
      toast.error(parseContractError(err))
    } finally {
      setChargingPolicyId(null)
      chargeHook.reset()
    }
  }

  // Handle revoke
  const handleRevoke = async (policyId: `0x${string}`) => {
    setRevokingPolicyId(policyId)
    try {
      await revokeHook.revokePolicy(policyId)
      toast.success('Subscription revoked')
      refetchPolicies()
    } catch (err) {
      toast.error(parseContractError(err))
    } finally {
      setRevokingPolicyId(null)
      revokeHook.reset()
    }
  }

  return (
    <div className="h-full overflow-auto">
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismissToast} />
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/10">
            <Beaker className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">SDK Demo</h2>
            <p className="text-sm text-muted-foreground">
              Test subscription creation flow
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Left Column: Create Subscription Form */}
          <div className="space-y-4">
            {/* Subscription Details Card */}
            <Card>
              <CardHeader className="py-3 px-4 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                  Configure Subscription
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Merchant Address */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Merchant Address
                  </label>
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="0x..."
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    The merchant's wallet address to receive payments
                  </p>
                </div>

                {/* Charge Amount */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Charge Amount (USDC)
                  </label>
                  <div className="mt-1.5 relative">
                    <input
                      type="number"
                      value={chargeAmount}
                      onChange={(e) => setChargeAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-16 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                      USDC
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Amount charged each billing cycle
                  </p>
                </div>

                {/* Interval */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Billing Interval
                  </label>
                  <select
                    value={interval}
                    onChange={(e) => setInterval(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {INTERVAL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Spending Cap */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Spending Cap (USDC)
                  </label>
                  <div className="mt-1.5 relative">
                    <input
                      type="number"
                      value={spendingCap}
                      onChange={(e) => setSpendingCap(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="1"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-16 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                      USDC
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Maximum total amount that can be charged (safety limit)
                  </p>
                </div>

                {/* Metadata URL */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Metadata URL <span className="text-muted-foreground/50">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={metadataUrl}
                    onChange={(e) => setMetadataUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Optional JSON metadata (subscription name, icon, etc.)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Approve */}
            <Card className={!needsApproval ? 'opacity-60' : ''}>
              <CardHeader className="py-3 px-4 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${!needsApproval ? 'bg-success/20 text-success' : 'bg-primary/10 text-primary'}`}>
                      {!needsApproval ? <Check className="h-3.5 w-3.5" /> : '2'}
                    </span>
                    Approve USDC
                  </CardTitle>
                  {!needsApproval && (
                    <Badge variant="success" className="text-[10px]">Approved</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Current Allowance</span>
                    <span className="font-mono">{formatUnits(approval.allowance, USDC_DECIMALS)} USDC</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Required for Cap</span>
                    <span className="font-mono">{spendingCap} USDC</span>
                  </div>

                  {needsApproval && (
                    <Button
                      onClick={handleApprove}
                      disabled={approval.isLoading || spendingCapBigInt === 0n}
                      className="w-full mt-2"
                      size="sm"
                    >
                      {approval.isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {approval.status}
                        </>
                      ) : (
                        <>
                          Approve {spendingCap} USDC
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  )}

                  {approval.error && (
                    <div className="flex items-center gap-2 text-destructive text-xs">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {approval.error}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Step 3: Create Subscription */}
            <Card className={needsApproval ? 'opacity-60' : ''}>
              <CardHeader className="py-3 px-4 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${createPolicy.policyId ? 'bg-success/20 text-success' : 'bg-primary/10 text-primary'}`}>
                    {createPolicy.policyId ? <Check className="h-3.5 w-3.5" /> : '3'}
                  </span>
                  Create Subscription
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {createPolicy.policyId ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
                      <p className="text-sm font-medium text-success mb-2">Subscription Created!</p>
                      <div className="space-y-2">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Policy ID</span>
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono truncate">{createPolicy.policyId}</code>
                            <button
                              onClick={() => copyToClipboard(createPolicy.policyId!, 'policyId')}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {copied === 'policyId' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Transaction</span>
                          <div className="flex items-center gap-2">
                            <a
                              href={`${chainConfig.explorer}/tx/${createPolicy.hash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              View on Explorer <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full" onClick={createPolicy.reset}>
                      Create Another
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      Ready to create subscription. First charge happens immediately.
                    </div>
                    <Button
                      onClick={handleCreate}
                      disabled={createPolicy.isLoading || needsApproval || !merchant || chargeAmountBigInt === 0n}
                      className="w-full"
                      size="sm"
                    >
                      {createPolicy.isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {createPolicy.status}
                        </>
                      ) : (
                        <>
                          Create Subscription
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>

                    {createPolicy.error && (
                      <div className="flex items-center gap-2 text-destructive text-xs">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {createPolicy.error}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Info & Recent Policies */}
          <div className="space-y-4">
            {/* Account Info */}
            <Card>
              <CardHeader className="py-3 px-4 border-b border-border/50">
                <CardTitle className="text-sm font-semibold">Your Account</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Wallet</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono">{account?.address?.slice(0, 6)}...{account?.address?.slice(-4)}</code>
                    <button
                      onClick={() => copyToClipboard(account?.address || '', 'wallet')}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {copied === 'wallet' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Balance</span>
                  <span className="text-sm font-medium">{balance ? Number(balance).toFixed(2) : '0.00'} USDC</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Network</span>
                  <Badge variant="outline" className="text-[10px]">{chainConfig.name}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Policy Manager</span>
                  <a
                    href={`${chainConfig.explorer}/address/${chainConfig.policyManager}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    {chainConfig.policyManager?.slice(0, 6)}...{chainConfig.policyManager?.slice(-4)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* SDK Code Example */}
            <Card>
              <CardHeader className="py-3 px-4 border-b border-border/50">
                <CardTitle className="text-sm font-semibold">SDK Usage</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <pre className="text-[11px] bg-muted/50 rounded-lg p-3 overflow-x-auto font-mono">
{`// 1. Check approval
const { isApproved, approve } = useApproval(policyManager)

if (!isApproved(spendingCap)) {
  await approve(spendingCap)
}

// 2. Create subscription
const { createPolicy } = useCreatePolicy()

const policyId = await createPolicy({
  merchant: '${merchant || '0x...'}',
  chargeAmount: ${chargeAmountBigInt}n, // ${chargeAmount} USDC
  interval: ${interval}, // ${INTERVAL_OPTIONS.find(o => o.value === interval)?.label}
  spendingCap: ${spendingCapBigInt}n, // ${spendingCap} USDC
  metadataUrl: '${metadataUrl || ''}'
})

console.log('Created:', policyId)`}
                </pre>
              </CardContent>
            </Card>

            {/* Recent Policies */}
            <Card>
              <CardHeader className="py-3 px-4 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Your Policies</CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refetchPolicies}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {policies.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No policies yet. Create one above.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {policies.slice(0, 10).map((policy) => {
                      const isCharging = chargingPolicyId === policy.policyId
                      const isRevoking = revokingPolicyId === policy.policyId
                      const nextChargeTime = policy.lastCharged + policy.interval
                      const canChargeNow = Date.now() / 1000 >= nextChargeTime

                      return (
                        <div key={policy.policyId} className="p-3 bg-muted/30 rounded-lg border border-border/50">
                          <div className="flex items-center justify-between mb-2">
                            <code className="text-[10px] font-mono text-muted-foreground">
                              {policy.policyId.slice(0, 10)}...{policy.policyId.slice(-8)}
                            </code>
                            <Badge variant={policy.active ? 'success' : 'secondary'} className="text-[10px]">
                              {policy.active ? 'Active' : 'Revoked'}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
                            <div>
                              <span className="text-muted-foreground">Merchant: </span>
                              <span className="font-mono">{policy.merchant.slice(0, 6)}...{policy.merchant.slice(-4)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Amount: </span>
                              <span>{formatUnits(policy.chargeAmount, USDC_DECIMALS)} USDC</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Spent: </span>
                              <span>{formatUnits(policy.totalSpent, USDC_DECIMALS)} USDC</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Charges: </span>
                              <span>{policy.chargeCount}</span>
                            </div>
                          </div>

                          {/* Action buttons */}
                          {policy.active && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant={canChargeNow ? 'default' : 'outline'}
                                className="flex-1 h-7 text-[11px]"
                                onClick={() => handleCharge(policy.policyId)}
                                disabled={isCharging || isRevoking || !canChargeNow}
                              >
                                {isCharging ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <Zap className="h-3 w-3 mr-1" />
                                    {canChargeNow ? 'Charge' : 'Not Due'}
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-7 text-[11px] text-destructive hover:text-destructive"
                                onClick={() => handleRevoke(policy.policyId)}
                                disabled={isCharging || isRevoking}
                              >
                                {isRevoking ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Revoke
                                  </>
                                )}
                              </Button>
                            </div>
                          )}

                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
