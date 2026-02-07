import * as React from 'react'
import { formatUnits, parseUnits } from 'viem'
import { useWallet, useChain, useCreatePolicy, usePolicies, useCharge, useRevokePolicy } from '../hooks'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import {
  ArrowRight,
  ArrowLeft,
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
  HelpCircle,
  CheckCircle2,
} from 'lucide-react'
import { USDC_DECIMALS } from '../config'
import { parseContractError } from '../types/policy'
import { ToastContainer, useToast } from '../components/ui/toast'
import { JsonHighlight } from '../components/ui/json-highlight'
import type { NavItem } from '../components/layout'

// Interval unit configuration
const INTERVAL_UNITS = [
  { label: 'Minutes', value: 'minutes', seconds: 60, max: 525600 },
  { label: 'Days', value: 'days', seconds: 86400, max: 365 },
  { label: 'Months', value: 'months', seconds: 2592000, max: 12 },
  { label: 'Years', value: 'years', seconds: 31536000, max: 1 },
] as const

type IntervalUnit = typeof INTERVAL_UNITS[number]['value']

const MIN_INTERVAL_SECONDS = 60
const MAX_INTERVAL_SECONDS = 365 * 24 * 60 * 60

// Metadata template for merchants
const METADATA_TEMPLATE = `{
  "version": "1.0",
  "plan": {
    "name": "Pro Plan",
    "description": "Access to all premium features",
    "tier": "pro",
    "features": [
      "Unlimited projects",
      "Priority support",
      "API access"
    ]
  },
  "merchant": {
    "name": "Your Company",
    "logo": "https://yoursite.com/logo.png",
    "website": "https://yoursite.com",
    "supportEmail": "support@yoursite.com",
    "termsUrl": "https://yoursite.com/terms",
    "privacyUrl": "https://yoursite.com/privacy"
  },
  "display": {
    "color": "#6366F1",
    "badge": "Most Popular"
  }
}`

const STEPS = [
  { label: 'Approve', key: 'approve' },
  { label: 'Configure', key: 'configure' },
  { label: 'Review', key: 'review' },
  { label: 'Success', key: 'success' },
] as const

interface DemoPageProps {
  onNavigate: (page: NavItem) => void
}

export function DemoPage({ onNavigate }: DemoPageProps) {
  const { isWalletSetup, isSettingUp, setupStatus, setupError, setupWallet, account, balance } = useWallet()
  const { chainConfig } = useChain()
  const { policies, refetch: refetchPolicies, refreshPolicyFromContract } = usePolicies()

  // Form state
  const [merchant, setMerchant] = React.useState('')
  const [chargeAmount, setChargeAmount] = React.useState('1')
  const [intervalAmount, setIntervalAmount] = React.useState('1')
  const [intervalUnit, setIntervalUnit] = React.useState<IntervalUnit>('days')
  const [spendingCap, setSpendingCap] = React.useState('100')
  const [metadataUrl, setMetadataUrl] = React.useState('')

  // Wizard state
  const [currentStep, setCurrentStep] = React.useState(() => isWalletSetup ? 1 : 0)

  // Sync step when wallet setup changes
  React.useEffect(() => {
    if (isWalletSetup && currentStep === 0) {
      setCurrentStep(1)
    }
  }, [isWalletSetup, currentStep])

  // Calculate interval in seconds with validation
  const intervalSeconds = React.useMemo(() => {
    const unit = INTERVAL_UNITS.find(u => u.value === intervalUnit)
    if (!unit) return 0
    const amount = parseInt(intervalAmount) || 0
    const seconds = amount * unit.seconds
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
      setCurrentStep(1)
    } catch (err) {
      toast.error(parseContractError(err))
    }
  }

  // Handle create subscription
  const handleCreate = async () => {
    if (!merchant) return

    try {
      const policyId = await createPolicy.createPolicy({
        merchant: merchant as `0x${string}`,
        chargeAmount: chargeAmountBigInt,
        interval: intervalSeconds,
        spendingCap: spendingCapBigInt,
        metadataUrl,
      })

      await refreshPolicyFromContract(policyId)
      setCurrentStep(3)
    } catch (err) {
      console.error('Create policy failed:', err)
    }
  }

  const [copied, setCopied] = React.useState<string | null>(null)
  const [showMetadataTemplate, setShowMetadataTemplate] = React.useState(false)

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
      await refreshPolicyFromContract(policyId)
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
      await refreshPolicyFromContract(policyId)
    } catch (err) {
      toast.error(parseContractError(err))
    } finally {
      setRevokingPolicyId(null)
      revokeHook.reset()
    }
  }

  // Form validation
  const isFormValid = merchant && chargeAmountBigInt > 0n && spendingCapBigInt > 0n && intervalSeconds > 0

  // Handle "Create Another"
  const handleCreateAnother = () => {
    createPolicy.reset()
    setMerchant('')
    setChargeAmount('1')
    setIntervalAmount('1')
    setIntervalUnit('days')
    setSpendingCap('100')
    setMetadataUrl('')
    setCurrentStep(1)
  }

  // Fee calculations
  const amt = parseFloat(chargeAmount) || 0
  const fee = amt * 0.025
  const net = amt - fee

  // Determine which steps to show (skip step 0 if wallet already set up)
  const visibleSteps = isWalletSetup
    ? STEPS.filter(s => s.key !== 'approve')
    : STEPS

  const getStepState = (stepIndex: number): 'pending' | 'active' | 'complete' => {
    if (stepIndex < currentStep) return 'complete'
    if (stepIndex === currentStep) return 'active'
    return 'pending'
  }

  return (
    <div className="h-full overflow-auto">
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismissToast} />
      <div className="space-y-4">
        {/* Main Layout: 2-column on desktop, stacked on mobile */}
        <div className="grid gap-4 lg:grid-cols-[1fr,340px] lg:items-start">
         <div className="space-y-3">
          {/* Stepper Bar — centered over wizard column */}
          <div className="demo-stepper">
            {visibleSteps.map((step, i) => {
              const stepIndex = STEPS.findIndex(s => s.key === step.key)
              const state = getStepState(stepIndex)
              const isLast = i === visibleSteps.length - 1

              return (
                <React.Fragment key={step.key}>
                  <div className={`demo-step demo-step--${state}`}>
                    <div className="demo-step-indicator">
                      {state === 'complete' ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <span>{isWalletSetup ? i + 1 : stepIndex}</span>
                      )}
                    </div>
                    <span className="demo-step-label">{step.label}</span>
                  </div>
                  {!isLast && (
                    <div className={`demo-step-connector ${state === 'complete' ? 'demo-step-connector--filled' : ''}`} />
                  )}
                </React.Fragment>
              )
            })}
          </div>
          {/* Step 0: Approve USDC */}
          {currentStep === 0 && !isWalletSetup && (
            <div className="demo-content" key="step-0">
              {/* Fund Wallet Link */}
              {account?.address && (
                <button
                  onClick={() => onNavigate('bridge')}
                  className="w-full flex items-center justify-between p-4 mb-4 bg-muted/30 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/50 transition-colors"
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
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}

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
                      One-time approval &bull; Requires passkey signature
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 1: Configure Subscription */}
          {currentStep === 1 && (
            <div className="demo-content" key="step-1">
              <Card>
                <CardHeader className="py-3 px-4 border-b border-border/50">
                  <CardTitle className="text-sm font-semibold">Configure Subscription</CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
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
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>

                  {/* Charge Amount + Spending Cap — side by side */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Charge Amount
                      </label>
                      <div className="mt-1.5 relative">
                        <input
                          type="number"
                          value={chargeAmount}
                          onChange={(e) => setChargeAmount(e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-14 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                          USDC
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Spending Cap
                      </label>
                      <div className="mt-1.5 relative">
                        <input
                          type="number"
                          value={spendingCap}
                          onChange={(e) => setSpendingCap(e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="1"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-14 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                          USDC
                        </span>
                      </div>
                    </div>
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
                        className="w-20 rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <select
                        value={intervalUnit}
                        onChange={(e) => setIntervalUnit(e.target.value as IntervalUnit)}
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        {INTERVAL_UNITS.map((unit) => (
                          <option key={unit.value} value={unit.value}>
                            {unit.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Metadata URL */}
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Metadata URL <span className="text-muted-foreground/50">(optional)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowMetadataTemplate(!showMetadataTemplate)}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded transition-colors"
                      >
                        <HelpCircle className="h-3 w-3" />
                        {showMetadataTemplate ? 'Hide' : 'View'} Template
                      </button>
                    </div>
                    <input
                      type="text"
                      value={metadataUrl}
                      onChange={(e) => setMetadataUrl(e.target.value)}
                      placeholder="https://yoursite.com/plans/pro.json"
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />

                  </div>

                  {/* Continue Button */}
                  <Button
                    onClick={() => setCurrentStep(2)}
                    disabled={!isFormValid}
                    className="w-full"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Review & Confirm */}
          {currentStep === 2 && (
            <div className="demo-content" key="step-2">
              <Card>
                <CardHeader className="py-4 px-5 border-b border-border/50">
                  <CardTitle className="text-base font-semibold">Review & Confirm</CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-5">
                  {/* Summary */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Merchant</span>
                      <code className="text-sm font-mono">{merchant.slice(0, 6)}...{merchant.slice(-4)}</code>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Charge Amount</span>
                      <span className="text-sm font-medium">{chargeAmount} USDC</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Billing Interval</span>
                      <span className="text-sm font-medium">Every {intervalAmount} {intervalUnit}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Spending Cap</span>
                      <span className="text-sm font-medium">{spendingCap} USDC</span>
                    </div>
                    {metadataUrl && (
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Metadata URL</span>
                        <span className="text-sm font-mono truncate max-w-[200px]">{metadataUrl}</span>
                      </div>
                    )}
                  </div>

                  {/* Fee Breakdown */}
                  <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fee Breakdown</span>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Charge amount</span>
                      <span>${amt.toFixed(2)} USDC</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Protocol fee (2.5%)</span>
                      <span className="text-destructive">-${fee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium border-t border-border/50 pt-2">
                      <span>Merchant receives</span>
                      <span>${net.toFixed(2)} USDC</span>
                    </div>
                  </div>

                  {/* Note */}
                  <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 bg-primary/5 rounded-lg border border-primary/10">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
                    <span>First charge happens immediately when the subscription is created.</span>
                  </div>

                  {/* Error */}
                  {createPolicy.error && (
                    <div className="flex items-center gap-2 text-destructive text-xs p-3 bg-destructive/10 rounded-lg">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      {createPolicy.error}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      className="flex-shrink-0"
                      size="lg"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={handleCreate}
                      disabled={createPolicy.isLoading}
                      className="flex-1"
                      size="lg"
                    >
                      {createPolicy.isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {createPolicy.status}
                        </>
                      ) : (
                        'Create Subscription'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 3: Success */}
          {currentStep === 3 && createPolicy.policyId && (
            <div className="demo-content" key="step-3">
              <Card className="border-success/30">
                <CardContent className="p-8 text-center space-y-5">
                  {/* Success Icon */}
                  <div className="flex justify-center">
                    <div className="demo-success-icon">
                      <CheckCircle2 className="h-10 w-10 text-success" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-1">Subscription Created!</h3>
                    <p className="text-sm text-muted-foreground">
                      Your recurring payment has been set up successfully.
                    </p>
                  </div>

                  {/* Policy ID */}
                  <div className="p-4 bg-muted/30 rounded-lg border border-border/50 text-left space-y-3">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Policy ID</span>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs font-mono truncate flex-1">{createPolicy.policyId}</code>
                        <button
                          onClick={() => copyToClipboard(createPolicy.policyId!, 'policyId')}
                          className="text-muted-foreground hover:text-foreground flex-shrink-0 p-1 rounded hover:bg-muted/50 transition-colors"
                        >
                          {copied === 'policyId' ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Transaction</span>
                      <div className="mt-1">
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

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={handleCreateAnother}
                      className="flex-1"
                      size="lg"
                    >
                      Create Another
                    </Button>
                    <Button
                      onClick={() => onNavigate('subscriptions')}
                      className="flex-1"
                      size="lg"
                    >
                      View Your Policies
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
         </div>

        {/* Your Policies - sidebar on desktop, below on mobile */}
        {isWalletSetup && (
          <div className="lg:sticky lg:top-0">
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
        )}
        </div>
      </div>

      {/* Metadata Template Modal — rendered outside scrollable container */}
      {showMetadataTemplate && (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            onClick={() => setShowMetadataTemplate(false)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] z-50 p-6 bg-popover border border-border rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <span className="text-lg font-semibold">Metadata Template</span>
              <button
                onClick={() => copyToClipboard(METADATA_TEMPLATE, 'metadata-template')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
              >
                {copied === 'metadata-template' ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Template
                  </>
                )}
              </button>
            </div>
            <JsonHighlight
              json={METADATA_TEMPLATE}
              className="max-h-[450px]"
            />
            <p className="mt-5 text-sm text-muted-foreground">
              Host this JSON at a public URL
            </p>
          </div>
        </>
      )}
    </div>
  )
}
