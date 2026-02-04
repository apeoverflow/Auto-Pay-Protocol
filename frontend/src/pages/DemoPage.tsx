import * as React from 'react'
import { formatUnits, parseUnits } from 'viem'
import { useWallet, useChain, useCreatePolicy, usePolicies, useCharge, useRevokePolicy } from '../hooks'
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
  Wallet,
  ArrowDownUp,
} from 'lucide-react'
import { USDC_DECIMALS } from '../config'
import { parseContractError } from '../types/policy'
import { ToastContainer, useToast } from '../components/ui/toast'
import { FundWalletCard } from '../components/FundWallet'

// Interval unit configuration
const INTERVAL_UNITS = [
  { label: 'Minutes', value: 'minutes', seconds: 60, max: 525600 }, // max 1 year in minutes
  { label: 'Days', value: 'days', seconds: 86400, max: 365 },
  { label: 'Months', value: 'months', seconds: 2592000, max: 12 }, // 30-day months
  { label: 'Years', value: 'years', seconds: 31536000, max: 1 },
] as const

type IntervalUnit = typeof INTERVAL_UNITS[number]['value']

const MIN_INTERVAL_SECONDS = 60 // 1 minute
const MAX_INTERVAL_SECONDS = 365 * 24 * 60 * 60 // 1 year

export function DemoPage() {
  const { isWalletSetup, isSettingUp, setupStatus, setupError, setupWallet, account, balance, fetchBalance } = useWallet()
  const { chainConfig } = useChain()
  const { policies, refetch: refetchPolicies } = usePolicies()

  // State for showing/hiding fund wallet section
  const [showFundWallet, setShowFundWallet] = React.useState(false)

  // Form state
  const [merchant, setMerchant] = React.useState('')
  const [chargeAmount, setChargeAmount] = React.useState('1')
  const [intervalAmount, setIntervalAmount] = React.useState('1')
  const [intervalUnit, setIntervalUnit] = React.useState<IntervalUnit>('days')
  const [spendingCap, setSpendingCap] = React.useState('100')
  const [metadataUrl, setMetadataUrl] = React.useState('')

  // Calculate interval in seconds with validation
  const intervalSeconds = React.useMemo(() => {
    const unit = INTERVAL_UNITS.find(u => u.value === intervalUnit)
    if (!unit) return 0
    const amount = parseInt(intervalAmount) || 0
    const seconds = amount * unit.seconds
    // Clamp to min/max
    if (seconds < MIN_INTERVAL_SECONDS) return MIN_INTERVAL_SECONDS
    if (seconds > MAX_INTERVAL_SECONDS) return MAX_INTERVAL_SECONDS
    return seconds
  }, [intervalAmount, intervalUnit])

  // Get max value for current unit
  const maxIntervalAmount = React.useMemo(() => {
    const unit = INTERVAL_UNITS.find(u => u.value === intervalUnit)
    return unit?.max || 1
  }, [intervalUnit])

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

  // Handle wallet setup
  const handleSetup = async () => {
    try {
      await setupWallet()
      toast.success('Wallet set up successfully!')
    } catch (err) {
      toast.error(parseContractError(err))
    }
  }

  // Handle create subscription
  const handleCreate = async () => {
    if (!merchant) return

    try {
      await createPolicy.createPolicy({
        merchant: merchant as `0x${string}`,
        chargeAmount: chargeAmountBigInt,
        interval: intervalSeconds,
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

        {/* Wallet Setup Required */}
        {!isWalletSetup ? (
          <div className="max-w-lg mx-auto space-y-4">
            {/* Fund Wallet Option */}
            {account?.address && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowFundWallet(!showFundWallet)}
                  className="w-full flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <ArrowDownUp className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">Need USDC on Arc?</p>
                      <p className="text-xs text-muted-foreground">
                        Transfer from MetaMask on another chain
                      </p>
                    </div>
                  </div>
                  <ArrowRight className={`h-4 w-4 text-muted-foreground transition-transform ${showFundWallet ? 'rotate-90' : ''}`} />
                </button>

                {showFundWallet && (
                  <FundWalletCard
                    destinationAddress={account.address}
                    onSuccess={() => {
                      fetchBalance()
                      toast.success('Wallet funded successfully!')
                    }}
                  />
                )}
              </div>
            )}

            {/* USDC Approval Card */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/[0.03] to-transparent">
              <CardHeader className="py-4 px-5 border-b border-border/50">
                <CardTitle className="text-base font-semibold flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  Approve USDC
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    Before creating subscriptions, you need to approve USDC spending. This one-time setup:
                  </div>

                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Approves AutoPay to charge your subscriptions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Security enforced via policy limits (amount, interval, cap)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span>Revoke any subscription instantly to stop charges</span>
                    </li>
                  </ul>

                  {/* Show current balance */}
                  {balance && (
                    <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Your Balance</span>
                        <span className="font-medium">{balance} USDC</span>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleSetup}
                    disabled={isSettingUp}
                    className="w-full"
                    size="lg"
                  >
                    {isSettingUp ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {setupStatus}
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Approve USDC
                      </>
                    )}
                  </Button>

                  {setupError && (
                    <div className="flex items-center gap-2 text-destructive text-xs p-3 bg-destructive/10 rounded-lg">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      {setupError}
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground/70 text-center">
                    One-time approval • Requires passkey signature
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Main Demo UI - Only shown after wallet setup */
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
                    <div className="mt-1.5 flex gap-2">
                      <input
                        type="number"
                        value={intervalAmount}
                        onChange={(e) => setIntervalAmount(e.target.value)}
                        min="1"
                        max={maxIntervalAmount}
                        className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <select
                        value={intervalUnit}
                        onChange={(e) => setIntervalUnit(e.target.value as IntervalUnit)}
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        {INTERVAL_UNITS.map((unit) => (
                          <option key={unit.value} value={unit.value}>
                            {unit.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Min: 1 minute, Max: 1 year
                    </p>
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

              {/* Step 2: Create Subscription */}
              <Card>
                <CardHeader className="py-3 px-4 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${createPolicy.policyId ? 'bg-success/20 text-success' : 'bg-primary/10 text-primary'}`}>
                        {createPolicy.policyId ? <Check className="h-3.5 w-3.5" /> : '2'}
                      </span>
                      Create Subscription
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] text-success border-success/30">
                      <Check className="h-2.5 w-2.5 mr-1" />
                      Wallet Ready
                    </Badge>
                  </div>
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
                      disabled={createPolicy.isLoading || !merchant || chargeAmountBigInt === 0n}
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
            {/* Contract Info */}
            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span>Policy Manager Contract</span>
              <a
                href={`${chainConfig.explorer}/address/${chainConfig.policyManager}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline flex items-center gap-1 font-mono"
              >
                {chainConfig.policyManager?.slice(0, 6)}...{chainConfig.policyManager?.slice(-4)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* SDK Code Example */}
            <Card>
              <CardHeader className="py-3 px-4 border-b border-border/50">
                <CardTitle className="text-sm font-semibold">SDK Usage</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <pre className="text-[11px] bg-muted/50 rounded-lg p-3 overflow-x-auto font-mono">
{`// 1. Setup wallet (one-time, on first use)
const { isWalletSetup, setupWallet } = useWallet()

if (!isWalletSetup) {
  await setupWallet() // Deploys wallet + approves USDC
}

// 2. Create subscription (just one signature!)
const { createPolicy } = useCreatePolicy()

const policyId = await createPolicy({
  merchant: '${merchant || '0x...'}',
  chargeAmount: ${chargeAmountBigInt}n, // ${chargeAmount} USDC
  interval: ${intervalSeconds}, // ${intervalAmount} ${intervalUnit}
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
        )}
      </div>
    </div>
  )
}
