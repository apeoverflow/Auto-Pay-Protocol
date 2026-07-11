import * as React from 'react'
import { parseUnits } from 'viem'
import { useDisconnect } from 'wagmi'
import { useCheckoutParams, useAuth, useWallet, useCreatePolicy, usePolicies } from '../hooks'
import { useShortCheckout } from '../hooks/useShortCheckout'
import { isTempoBuild } from '../contexts/TempoWalletContext'
import { USDC_DECIMALS, UNLIMITED_APPROVAL_THRESHOLD } from '../config'
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
import logoUrl from '../assets/Autopay-full.svg'

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
  const { address, allowance, allowanceLoaded, isLoading: walletLoading, balance } = useWallet()
  const { policies: existingPolicies } = usePolicies()
  const { createPolicy, policyId, hash, status, error: policyError, isLoading: policyLoading } = useCreatePolicy()
  const [metadata, setMetadata] = React.useState<CheckoutMetadata | null>(null)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [step, setStep] = React.useState<Step>('loading')
  const [reviewedPlan, setReviewedPlan] = React.useState(false)
  const [subscriberFormData, setSubscriberFormData] = React.useState<Record<string, string> | null>(null)
  // User-editable spending cap — defaults to Unlimited, adjustable in ConfirmStep.
  // Merchant-supplied URL caps are ignored on init so the picker starts open-ended
  // (matches the approval picker's Unlimited default).
  const [userSpendingCap, setUserSpendingCap] = React.useState<string | undefined>(undefined)

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

  // The user's chosen lifetime cap (Layer 2) and the per-charge amount.
  // Tempo uses a server-side relayer-managed wallet whose approve endpoint can't
  // be parameterized — it always grants unlimited. So on Tempo we lock the
  // approval picker to unlimited; the per-policy spendingCap (Layer 2) still applies.
  const isTempo = isTempoBuild()
  // Both amount and spendingCap come from URL/user input — parseUnits throws on
  // malformed strings, so guard against that to keep the page from crashing.
  const tryParseUSDC = (s: string | undefined | null): bigint | null => {
    if (!s) return null
    try { return parseUnits(s, USDC_DECIMALS) } catch { return null }
  }
  const capAmount = tryParseUSDC(userSpendingCap)
  const chargeAmount = tryParseUSDC(params?.amount) ?? 0n

  // When the user explicitly steps through wallet_setup we trust their choice
  // and let them through, even if they picked a custom amount below the cap.
  // Without this, picking a sub-cap custom value would re-enter wallet_setup
  // forever (the gate would never be satisfied).
  const [userApprovedThisFlow, setUserApprovedThisFlow] = React.useState(false)

  // If the user changes their cap in ConfirmStep after approving, that earlier
  // approval is no longer authoritative for the new cap — clear the bypass so
  // the gate re-evaluates against the new value (may re-route to wallet_setup).
  React.useEffect(() => {
    setUserApprovedThisFlow(false)
  }, [userSpendingCap])

  // Projected 12-month spend across the payer's existing active subscriptions —
  // a forward-looking estimate of how much the contract will actually be asked
  // to charge this wallet over the next year. Per sub: chargeAmount * (year /
  // interval). Uncapped active sub → committed total is effectively unlimited
  // (only an unlimited allowance can ever cover it).
  const SECONDS_PER_YEAR = 31_536_000n // 365 days
  const projectedAnnualExisting = React.useMemo(() => {
    let sum = 0n
    let anyUnlimited = false
    for (const p of existingPolicies) {
      if (!p.active) continue
      if (p.spendingCap === 0n) { anyUnlimited = true; continue }
      if (p.interval <= 0) continue
      const chargesPerYear = SECONDS_PER_YEAR / BigInt(p.interval)
      sum += p.chargeAmount * chargesPerYear
    }
    return { total: sum, anyUnlimited }
  }, [existingPolicies])

  // 12-month projection for the sub being created (0 if interval/charge unknown).
  const projectedAnnualNew = React.useMemo(() => {
    const interval = params?.interval ?? 0
    if (interval <= 0 || chargeAmount === 0n) return 0n
    return chargeAmount * (SECONDS_PER_YEAR / BigInt(interval))
  }, [params?.interval, chargeAmount])

  // Does the current allowance cover 12 months across all active subs + this
  // new one? The cap is a lifetime ceiling, not a rate — so an uncapped *new*
  // sub still has a well-defined 12-month projection and a finite allowance
  // can cover it. Skip cases:
  // - Allowance is already unlimited → covers anything.
  // - userApprovedThisFlow: they just approved in this flow, don't loop back.
  // Force unlimited when:
  // - Tempo (server-side approve is always unlimited), or
  // - any existing sub is uncapped and we don't know its true rate.
  // Otherwise: required = projectedAnnualExisting + projectedAnnualNew.
  const isApprovalSufficient = React.useMemo(() => {
    if (!allowanceLoaded) return false
    if (userApprovedThisFlow) return true
    if (allowance >= UNLIMITED_APPROVAL_THRESHOLD) return true
    const needsUnlimited = isTempo || projectedAnnualExisting.anyUnlimited
    if (needsUnlimited) return false
    const required = projectedAnnualExisting.total + projectedAnnualNew
    return chargeAmount > 0n && allowance >= required
  }, [allowanceLoaded, allowance, isTempo, chargeAmount, userApprovedThisFlow, projectedAnnualExisting, projectedAnnualNew])

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
    if (!isApprovalSufficient) {
      setStep('wallet_setup')
      return
    }
    if (!hasEnoughBalance) {
      setStep('fund_wallet')
      return
    }
    setStep('confirm')
  }, [paramError, fetchError, metadata, policyId, policyLoading, reviewedPlan, hasSubscriberFields, subscriberFormData, isLoggedIn, walletLoading, isApprovalSufficient, hasEnoughBalance])

  const handleSubscribe = async () => {
    if (!metadata || !params) return
    if (chargeAmount === 0n) return // unreachable in normal flows — defensive guard

    try {
      await createPolicy({
        merchant: params.merchant,
        chargeAmount,
        interval: params.interval,
        spendingCap: capAmount ?? 0n, // 0 = unlimited in the contract
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
              <img src={logoUrl} alt="AutoPay" className="h-7 w-auto brightness-0 opacity-50" />
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
          {step === 'wallet_setup' && params && (
            <WalletSetupStep
              cancelUrl={params.cancelUrl}
              chargeAmount={chargeAmount}
              capAmount={capAmount}
              currentAllowance={allowance}
              isUnlimitedAllowance={allowance >= UNLIMITED_APPROVAL_THRESHOLD}
              projectedAnnualExisting={projectedAnnualExisting.total}
              projectedAnnualNew={projectedAnnualNew}
              hasUnlimitedExistingSub={projectedAnnualExisting.anyUnlimited}
              isTempo={isTempo}
              onApproved={() => setUserApprovedThisFlow(true)}
            />
          )}
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
