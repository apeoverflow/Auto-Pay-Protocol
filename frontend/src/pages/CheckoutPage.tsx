import * as React from 'react'
import { parseUnits } from 'viem'
import { useCheckoutParams, useAuth, useWallet, useCreatePolicy, useChain } from '../hooks'
import { USDC_DECIMALS } from '../config'
import type { CheckoutMetadata } from '../types/checkout'
import {
  LoadingStep,
  ErrorStep,
  PlanSummary,
  AuthStep,
  WalletSetupStep,
  FundWalletStep,
  ConfirmStep,
  ProcessingStep,
  SuccessStep,
} from '../components/checkout'

type Step = 'loading' | 'error' | 'plan_summary' | 'auth' | 'wallet_setup' | 'fund_wallet' | 'confirm' | 'processing' | 'success'

export function CheckoutPage() {
  const { params, error: paramError } = useCheckoutParams()
  const { isLoggedIn, logout, username } = useAuth()
  const { isWalletSetup, isLoading: walletLoading, balance } = useWallet()
  const { createPolicy, policyId, hash, status, error: policyError, isLoading: policyLoading } = useCreatePolicy()
  const { setChainKey } = useChain()

  const [metadata, setMetadata] = React.useState<CheckoutMetadata | null>(null)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [step, setStep] = React.useState<Step>('loading')
  const [reviewedPlan, setReviewedPlan] = React.useState(false)
  // User-editable spending cap — defaults to unlimited, adjustable in ConfirmStep
  const [userSpendingCap, setUserSpendingCap] = React.useState<string | undefined>(undefined)

  // Ensure Flow EVM is selected for checkout
  React.useEffect(() => {
    setChainKey('flowEvm')
  }, [setChainKey])

  // Estimated gas fee in USDC (Arc native currency is USDC; paymaster covers it but we show for transparency)
  const GAS_ESTIMATE_USDC = 0.01

  // Billing comes from URL params (on-chain source of truth), not metadata
  const amount = params?.amount ?? '0'
  const interval = params?.interval ?? 0

  // Check if user has enough balance for the subscription + gas
  const hasEnoughBalance = React.useMemo(() => {
    if (!params?.amount || balance === null) return false
    const totalNeeded = parseFloat(params.amount) + GAS_ESTIMATE_USDC
    return parseFloat(balance) >= totalNeeded
  }, [balance, params?.amount])

  // Fetch display metadata on mount (plan name, description, features, merchant branding)
  React.useEffect(() => {
    if (!params) return

    fetch(params.metadataUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch metadata: ${res.status}`)
        return res.json()
      })
      .then((data: CheckoutMetadata) => {
        if (!data.plan?.name) {
          throw new Error('Invalid metadata: missing required field (plan.name)')
        }
        setMetadata(data)
      })
      .catch((err) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load plan details')
      })
  }, [params])

  // Determine current step based on state
  React.useEffect(() => {
    if (paramError) {
      setStep('error')
      return
    }
    if (fetchError) {
      setStep('error')
      return
    }
    if (!metadata) {
      setStep('loading')
      return
    }
    if (policyId) {
      setStep('success')
      return
    }
    if (policyLoading) {
      setStep('processing')
      return
    }
    // Always show plan summary first
    if (!reviewedPlan) {
      setStep('plan_summary')
      return
    }
    if (!isLoggedIn) {
      setStep('auth')
      return
    }
    if (walletLoading) {
      setStep('loading')
      return
    }
    if (!isWalletSetup) {
      setStep('wallet_setup')
      return
    }
    if (!hasEnoughBalance) {
      setStep('fund_wallet')
      return
    }
    setStep('confirm')
  }, [paramError, fetchError, metadata, policyId, policyLoading, reviewedPlan, isLoggedIn, walletLoading, isWalletSetup, hasEnoughBalance])

  const handleSubscribe = async () => {
    if (!metadata || !params) return

    try {
      await createPolicy({
        merchant: params.merchant,
        chargeAmount: parseUnits(params.amount, USDC_DECIMALS),
        interval: params.interval,
        spendingCap: userSpendingCap
          ? parseUnits(userSpendingCap, USDC_DECIMALS)
          : 0n, // 0 = unlimited in the contract
        metadataUrl: params.metadataUrl,
      })
    } catch {
      // Error displayed via hook state
    }
  }

  const handlePlanContinue = () => {
    setReviewedPlan(true)
  }

  const handleFunded = () => {
    setStep('confirm')
  }

  const errorMessage = paramError || fetchError || ''

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Card */}
        <div className="bg-card rounded-2xl shadow-lg shadow-black/5 border border-border p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="AutoPay" className="h-7 w-auto brightness-0 opacity-50" />
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                Testnet
              </span>
              {isLoggedIn && (
                <button
                  onClick={logout}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  title={username ? `Signed in as ${username}` : 'Sign out'}
                >
                  Log out
                </button>
              )}
            </div>
          </div>

          {/* Step content */}
          {step === 'loading' && <LoadingStep />}
          {step === 'error' && <ErrorStep message={errorMessage} cancelUrl={params?.cancelUrl} />}
          {step === 'plan_summary' && metadata && params && (
            <PlanSummary
              metadata={metadata}
              metadataUrl={params.metadataUrl}
              amount={amount}
              interval={interval}
              onContinue={handlePlanContinue}
              cancelUrl={params.cancelUrl}
            />
          )}
          {step === 'auth' && params && <AuthStep cancelUrl={params.cancelUrl} />}
          {step === 'wallet_setup' && params && <WalletSetupStep cancelUrl={params.cancelUrl} />}
          {step === 'fund_wallet' && params && (
            <FundWalletStep
              requiredAmount={amount}
              gasEstimate={GAS_ESTIMATE_USDC}
              cancelUrl={params.cancelUrl}
              onFunded={handleFunded}
            />
          )}
          {step === 'confirm' && metadata && params && (
            <ConfirmStep
              metadata={metadata}
              merchant={params.merchant}
              amount={amount}
              interval={interval}
              spendingCap={userSpendingCap}
              onSpendingCapChange={setUserSpendingCap}
              onSubscribe={handleSubscribe}
              isLoading={policyLoading}
              error={policyError}
              cancelUrl={params.cancelUrl}
            />
          )}
          {step === 'processing' && <ProcessingStep status={status} />}
          {step === 'success' && metadata && policyId && params && (
            <SuccessStep
              metadata={metadata}
              policyId={policyId}
              txHash={hash}
              amount={amount}
              interval={interval}
              successUrl={params.successUrl}
            />
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground mt-4">
          Powered by AutoPay Protocol &middot; Non-custodial &middot; Flow Mainnet
        </p>
      </div>
    </div>
  )
}
