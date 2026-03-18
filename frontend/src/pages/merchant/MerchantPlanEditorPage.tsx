import * as React from 'react'
import { Card, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { TagInput } from '../../components/ui/tag-input'
import { PlanPreviewCard } from '../../components/shared/PlanPreviewCard'
import { PricingCard } from '../../components/shared/PricingCard'
import { useMerchantPlan } from '../../hooks/useMerchantPlan'
import { useWallet } from '../../hooks/useWallet'
import { createPlan, updatePlan, uploadLogo } from '../../lib/relayer'
import { useSignMessage } from 'wagmi'
import { Loader2, Save, Rocket, Upload, X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import type { Route } from '../../hooks/useRoute'

const INTERVALS = [
  { value: 'seconds', label: 'Every Second' },
  { value: 'minutes', label: 'Every Minute' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

const STEPS = [
  { id: 'plan', label: 'Plan' },
  { id: 'merchant', label: 'Merchant' },
  { id: 'billing', label: 'Billing' },
] as const

type StepId = (typeof STEPS)[number]['id']

interface MerchantPlanEditorPageProps {
  navigate: (to: Route, search?: string) => void
}

export function MerchantPlanEditorPage({ navigate }: MerchantPlanEditorPageProps) {
  const { address } = useWallet()
  const { signMessageAsync } = useSignMessage()

  // Determine mode from URL
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const editId = params.get('id')
  const isEdit = !!editId

  const { plan: existingPlan, isLoading: loadingPlan } = useMerchantPlan(editId)

  // Step state
  const [currentStep, setCurrentStep] = React.useState(0)

  // Form state
  const [planName, setPlanName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [tier, setTier] = React.useState('')
  const [features, setFeatures] = React.useState<string[]>([])
  const [merchantName, setMerchantName] = React.useState('')
  const [logoUrl, setLogoUrl] = React.useState('')
  const [website, setWebsite] = React.useState('')
  const [supportEmail, setSupportEmail] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [interval, setInterval] = React.useState('monthly')
  const [cap, setCap] = React.useState('')
  const [color, setColor] = React.useState('')
  const [badge, setBadge] = React.useState('')

  // Logo upload state
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Populate form when editing
  React.useEffect(() => {
    if (!existingPlan?.metadata) return
    const m = existingPlan.metadata as Record<string, unknown>
    const plan = m.plan as Record<string, unknown> | undefined
    const merchant = m.merchant as Record<string, unknown> | undefined
    const billing = m.billing as Record<string, unknown> | undefined
    const display = m.display as Record<string, unknown> | undefined

    if (plan) {
      setPlanName((plan.name as string) || '')
      setDescription((plan.description as string) || '')
      setTier((plan.tier as string) || '')
      setFeatures(Array.isArray(plan.features) ? (plan.features as string[]) : [])
    }
    if (merchant) {
      setMerchantName((merchant.name as string) || '')
      setLogoUrl((merchant.logo as string) || '')
      setWebsite((merchant.website as string) || '')
      setSupportEmail((merchant.supportEmail as string) || '')
    }
    if (billing) {
      setAmount(String(billing.amount || ''))
      setInterval((billing.interval as string) || 'monthly')
      setCap(String(billing.cap || ''))
    }
    if (display) {
      setColor((display.color as string) || '')
      setBadge((display.badge as string) || '')
    }
  }, [existingPlan])

  const handleSubmit = async (status: 'draft' | 'active') => {
    if (!address) return
    if (!planName.trim() || !description.trim() || !merchantName.trim()) {
      setError('Plan name, description, and merchant name are required.')
      // Jump to the step with the missing field
      if (!planName.trim() || !description.trim()) setCurrentStep(0)
      else if (!merchantName.trim()) setCurrentStep(1)
      return
    }

    setSaving(true)
    setError(null)

    const body: Record<string, unknown> = {
      status,
      plan: {
        name: planName.trim(),
        description: description.trim(),
        ...(tier.trim() && { tier: tier.trim() }),
        ...(features.length > 0 && { features }),
      },
      merchant: {
        name: merchantName.trim(),
        // Always store bare filename — strip any absolute URL prefix from the relayer/Supabase
        ...(logoUrl.trim() && { logo: logoUrl.trim().split('/').pop() }),
        ...(website.trim() && { website: website.trim() }),
        ...(supportEmail.trim() && { supportEmail: supportEmail.trim() }),
      },
      ...(amount && {
        billing: {
          amount: parseFloat(amount),
          interval,
          cap: cap ? parseFloat(cap) : parseFloat(amount) * 12,
          currency: 'USDC',
        },
      }),
      ...((color.trim() || badge.trim()) && {
        display: {
          ...(color.trim() && { color: color.trim() }),
          ...(badge.trim() && { badge: badge.trim() }),
        },
      }),
    }

    try {
      if (isEdit && editId) {
        await updatePlan(address, editId, body, signMessageAsync)
      } else {
        // Auto-generate ID from plan name + random slug
        const slug = planName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const rand = Math.random().toString(36).slice(2, 7)
        body.id = slug ? `${slug}-${rand}` : rand
        await createPlan(address, body, signMessageAsync)
      }
      navigate('/merchant/plans')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan')
    } finally {
      setSaving(false)
    }
  }

  // Check which steps have been "visited" (have data)
  const stepHasData = (stepId: StepId): boolean => {
    switch (stepId) {
      case 'plan': return !!(planName || description)
      case 'merchant': return !!merchantName
      case 'billing': return !!amount
    }
  }

  // Derive preview props from form state
  const featuresList = features.length > 0 ? features : undefined
  const previewProps = {
    plan: { name: planName, description, features: featuresList },
    merchant: { name: merchantName, logo: logoUrl || undefined },
    amount: amount || '0',
    interval,
    display: (color || badge) ? { color: color || undefined, badge: badge || undefined } : undefined,
    logoPreviewUrl: logoPreview || undefined,
  }

  if (isEdit && loadingPlan) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(0,640px)] gap-5">
      {/* Left column — Stepped Form */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          {isEdit ? 'Edit Plan' : 'Create Plan'}
        </h2>

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => {
            const isActive = i === currentStep
            const isCompleted = i < currentStep || (i < STEPS.length && stepHasData(step.id))
            return (
              <React.Fragment key={step.id}>
                {i > 0 && (
                  <div className={`flex-1 h-px mx-1 transition-colors ${i <= currentStep ? 'bg-primary' : 'bg-border'}`} />
                )}
                <button
                  type="button"
                  onClick={() => setCurrentStep(i)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                    ${isActive
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                        ? 'bg-primary/10 text-primary hover:bg-primary/20'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }
                  `}
                >
                  {isCompleted && !isActive ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <span className="w-4 text-center">{i + 1}</span>
                  )}
                  {step.label}
                </button>
              </React.Fragment>
            )
          })}
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Step content */}
        <Card>
          <CardContent className="pt-5 space-y-3 min-h-[340px]">
            {/* Step 1: Plan */}
            {currentStep === 0 && (
              <>
                <Input
                  label="Name *"
                  placeholder="Pro Plan"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                />
                <div className="space-y-1 md:space-y-2">
                  <label className="text-[12px] md:text-sm font-medium leading-none text-foreground">
                    Description *
                  </label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:border-primary/30 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                    placeholder="Access to premium features..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
<Input
                  label="Tier (optional)"
                  placeholder="pro"
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                />
                <TagInput
                  label="Features (optional)"
                  placeholder="Type a feature, press comma to add"
                  tags={features}
                  onChange={setFeatures}
                />
              </>
            )}

            {/* Step 2: Merchant */}
            {currentStep === 1 && (
              <>
                {/* Name + Logo on same row */}
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Input
                      label="Name *"
                      placeholder="Acme Inc"
                      value={merchantName}
                      onChange={(e) => setMerchantName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[12px] md:text-sm font-medium leading-none text-foreground">
                      Logo
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file || !address) return
                        setUploadingLogo(true)
                        setError(null)
                        try {
                          setLogoPreview(URL.createObjectURL(file))
                          const filename = await uploadLogo(address, file, signMessageAsync)
                          setLogoUrl(filename)
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Failed to upload logo')
                          setLogoPreview(null)
                          setLogoUrl('')
                        } finally {
                          setUploadingLogo(false)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }
                      }}
                    />
                    {logoUrl || logoPreview ? (
                      <div className="relative group w-14 h-14">
                        <img
                          src={logoPreview || (logoUrl.startsWith('http') ? logoUrl : `${import.meta.env.VITE_RELAYER_URL || ''}/logos/${logoUrl}`)}
                          alt="Logo"
                          className="w-14 h-14 rounded-xl object-cover border border-input"
                          onError={() => {
                            setLogoPreview(null)
                            setLogoUrl('')
                          }}
                        />
                        <div
                          className="absolute inset-0 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-3.5 w-3.5 text-white" />
                        </div>
                        <button
                          type="button"
                          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            setLogoUrl('')
                            setLogoPreview(null)
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={uploadingLogo}
                        className="flex items-center justify-center w-14 h-14 rounded-xl border-2 border-dashed border-input hover:border-primary/40 transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploadingLogo ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <Input
                  label="Website (optional)"
                  placeholder="https://example.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
                <Input
                  label="Support Email (optional)"
                  placeholder="support@example.com"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                />
                {/* Color picker + hex input */}
                <div className="space-y-1 md:space-y-2">
                  <label className="text-[12px] md:text-sm font-medium leading-none text-foreground">
                    Brand Color (optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color || '#6366F1'}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-10 h-10 rounded-lg border border-input cursor-pointer p-0.5"
                    />
                    <input
                      placeholder="#6366F1"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="flex h-10 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:border-primary/30 transition-all duration-200"
                    />
                  </div>
                </div>
                <Input
                  label="Badge (optional)"
                  placeholder="Most Popular"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                />
              </>
            )}

            {/* Step 3: Billing */}
            {currentStep === 2 && (
              <>
                <Input
                  label="Amount (USDC)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="9.99"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <div className="space-y-1 md:space-y-2">
                  <label className="text-[12px] md:text-sm font-medium leading-none text-foreground">
                    Interval
                  </label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:border-primary/30 transition-all duration-200"
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                  >
                    {INTERVALS.map((i) => (
                      <option key={i.value} value={i.value}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Spending Cap (USDC, optional)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Auto-calculated from amount x 12"
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigation + Actions */}
        <div className="flex items-center justify-between">
          <div>
            {currentStep > 0 && (
              <Button
                variant="ghost"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentStep < STEPS.length - 1 ? (
              <Button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => handleSubmit('draft')}
                  className="gap-1.5"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Draft
                </Button>
                <Button
                  disabled={saving}
                  onClick={() => handleSubmit('active')}
                  className="gap-1.5"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  Publish
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => navigate('/merchant/plans')}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Right column — Live Previews side-by-side (desktop only) */}
      <div className="hidden lg:block">
        <div className="sticky top-6 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Checkout Preview
            </p>
            <div className="origin-top-left scale-[0.75]" style={{ width: 'calc(100% / 0.75)' }}>
              <div className="rounded-xl border border-border bg-card p-4">
                <PlanPreviewCard {...previewProps} maxFeatures={3} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Pricing Preview
            </p>
            <div className="origin-top-left scale-[0.75]" style={{ width: 'calc(100% / 0.75)' }}>
              <PricingCard {...previewProps} maxFeatures={3} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
