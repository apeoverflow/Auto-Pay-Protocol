import * as React from 'react'
import { parseUnits } from 'viem'
import { useDisconnect } from 'wagmi'
import { useCheckoutParams, useAuth, useWallet, useCreatePolicy } from '../hooks'
import { useShortCheckout } from '../hooks/useShortCheckout'
import { USDC_DECIMALS } from '../config'
import { CHAIN_CONFIGS, DEFAULT_CHAIN } from '../config/chains'
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
  SubscriberInfoStep,
} from '../components/checkout'
import { submitSubscriberData } from '../lib/relayer'

type Step = 'loading' | 'error' | 'plan_summary' | 'subscriber_info' | 'auth' | 'wallet_setup' | 'fund_wallet' | 'confirm' | 'processing' | 'success'

export function CheckoutPage() {
  const isShortLink = typeof window !== 'undefined' && window.location.pathname.startsWith('/pay/')
  const shortCheckout = useShortCheckout()
  const queryCheckout = useCheckoutParams()

  const params = isShortLink ? shortCheckout.params : queryCheckout.params
  const paramError = isShortLink
    ? (shortCheckout.isLoading ? null : shortCheckout.error)
    : queryCheckout.error
  const { isLoggedIn, username } = useAuth()
  const { disconnect } = useDisconnect()
  const { address, isWalletSetup, isLoading: walletLoading, balance } = useWallet()
  const { createPolicy, policyId, hash, status, error: policyError, isLoading: policyLoading } = useCreatePolicy()
  const [metadata, setMetadata] = React.useState<CheckoutMetadata | null>(null)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [step, setStep] = React.useState<Step>('loading')
  const [reviewedPlan, setReviewedPlan] = React.useState(false)
  const [subscriberFormData, setSubscriberFormData] = React.useState<Record<string, string> | null>(null)
  // User-editable spending cap — defaults to URL param value, adjustable in ConfirmStep
  const [userSpendingCap, setUserSpendingCap] = React.useState<string | undefined>(params?.spendingCap)

  const hasSubscriberFields = !!(params?.fields && params.fields.length > 0)

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
  // Falls back to IPFS metadata URL if the primary (relayer) URL fails
  React.useEffect(() => {
    if (!params) return

    const fetchMetadata = async () => {
      const urls = [params.metadataUrl, params.ipfsMetadataUrl].filter(Boolean) as string[]

      for (const url of urls) {
        try {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data: CheckoutMetadata = await res.json()
          if (!data.plan?.name) {
            throw new Error('Invalid metadata: missing required field (plan.name)')
          }
          setMetadata(data)
          return
        } catch (err) {
          // If this was the last URL, report the error
          if (url === urls[urls.length - 1]) {
            setFetchError(err instanceof Error ? err.message : 'Failed to load plan details')
          }
          // Otherwise try next URL
        }
      }
    }

    fetchMetadata()
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
    // Show subscriber info form if fields are configured and not yet filled
    if (hasSubscriberFields && !subscriberFormData) {
      setStep('subscriber_info')
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
  }, [paramError, fetchError, metadata, policyId, policyLoading, reviewedPlan, hasSubscriberFields, subscriberFormData, isLoggedIn, walletLoading, isWalletSetup, hasEnoughBalance])

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

  // Fire-and-forget: submit subscriber data after policy is created
  React.useEffect(() => {
    if (!policyId || !subscriberFormData || !params || !address) return
    const chainId = CHAIN_CONFIGS[DEFAULT_CHAIN].chain.id
    // Extract planId from metadataUrl if it follows the /metadata/:merchant/:planId pattern
    let planId: string | undefined
    let planMerchant: string | undefined
    try {
      const urlPath = new URL(params.metadataUrl).pathname
      const segments = urlPath.split('/').filter(Boolean)
      if (segments[0] === 'metadata' && segments.length >= 3) {
        planMerchant = segments[1]
        planId = segments[2]
      }
    } catch { /* ignore */ }

    submitSubscriberData({
      policyId,
      chainId,
      payer: address,
      merchant: params.merchant,
      planId,
      planMerchant,
      formData: subscriberFormData,
    }).catch(() => {
      // Subscriber data is fire-and-forget — don't block the user
    })
  }, [policyId, subscriberFormData, params, address])

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
                  onClick={() => disconnect()}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  title={username ? `Signed in as ${username}` : 'Sign out'}
                >
                  Log out
                </button>
              )}
            </div>
          </div>

          {/* Custom relayer warning */}
          {isShortLink && shortCheckout.isCustomRelayer && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-600 mb-4">
              This checkout is served by a third-party relayer. Verify the merchant and amount before proceeding.
            </div>
          )}

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
          {step === 'subscriber_info' && params?.fields && (
            <SubscriberInfoStep
              fields={params.fields}
              onContinue={(formData) => setSubscriberFormData(formData)}
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
          Powered by AutoPay Protocol &middot; Non-custodial &middot; {CHAIN_CONFIGS[DEFAULT_CHAIN].name}
        </p>
      </div>
    </div>
  )
}
