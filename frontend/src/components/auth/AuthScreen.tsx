import * as React from 'react'
import { useRecovery } from '../../hooks'
import { Button } from '../ui/button'
import { TextArea } from '../ui/input'
import { Alert, AlertTitle, AlertDescription } from '../ui/alert'
import { StatusMessage } from '../common/StatusMessage'
import { PasskeyLogin } from './PasskeyLogin'
import { RecoveryScreen } from '../recovery/RecoveryScreen'
import { DocsPage } from '../../pages/DocsPage'
import {
  Fingerprint,
  KeyRound,
  CheckCircle,
  Loader2,
  Wallet,
  BadgePercent,
  Globe,
  BookOpen,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'

type AuthTab = 'passkey' | 'recovery'

export function AuthScreen() {
  const { showRecovery, setShowRecovery } = useRecovery()
  const [activeTab, setActiveTab] = React.useState<AuthTab>('passkey')
  const [showDocs, setShowDocs] = React.useState(false)

  React.useEffect(() => {
    if (showRecovery) setActiveTab('recovery')
  }, [showRecovery])

  const selectTab = (tab: AuthTab) => {
    setActiveTab(tab)
    setShowRecovery(tab === 'recovery')
  }

  if (showRecovery && activeTab !== 'recovery') {
    return <RecoveryScreen onCancel={() => setShowRecovery(false)} />
  }

  // Show docs page with back button
  if (showDocs) {
    return (
      <div className="flex h-screen flex-col bg-background overflow-hidden">
        {/* Header with back button */}
        <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-border/50 bg-white/80 backdrop-blur-sm px-4">
          <button
            onClick={() => setShowDocs(false)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </button>
          <div className="ml-auto flex items-center gap-2">
            <img src="/logo.png" alt="AutoPayProtocol" className="h-6 w-auto opacity-80" />
          </div>
        </header>
        {/* Docs content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <DocsPage />
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'passkey' as const, label: 'Passkey', icon: Fingerprint },
    { id: 'recovery' as const, label: 'Recover', icon: KeyRound },
  ]

  return (
    <div className="auth-scene">
      {/* background layers */}
      <div className="auth-orb auth-orb--1" />
      <div className="auth-orb auth-orb--2" />
      <div className="auth-orb auth-orb--3" />
      <div className="auth-grid" />

      {/* split layout */}
      <div className="auth-split">
        {/* ─── left: brand panel ─── */}
        <div className="auth-brand">
          <div className="auth-brand-content">
            <img
              src="/logo.png"
              alt="AutoPayProtocol"
              className="auth-brand-logo"
            />
            <h1 className="auth-brand-headline">
              Subscription payments
              <br />
              at half the cost
            </h1>
            <p className="auth-brand-sub" style={{ color: 'hsl(220 15% 72%)' }}>
              Accept recurring USDC payments for your newsletter, DAO, or SaaS.
              2.5% fees — 50% less than traditional processors.
            </p>

            <div className="auth-brand-features" style={{ gap: '14px' }}>
              <div className="auth-feature" style={{ color: 'hsl(220 15% 80%)' }}>
                <div className="auth-feature-icon" style={{ background: 'hsl(220 60% 50% / 0.2)', color: 'hsl(220 80% 70%)' }}>
                  <Wallet className="h-[18px] w-[18px]" />
                </div>
                <span>Non-custodial — funds stay in user wallets</span>
              </div>
              <div className="auth-feature" style={{ color: 'hsl(220 15% 80%)' }}>
                <div className="auth-feature-icon" style={{ background: 'hsl(150 60% 40% / 0.2)', color: 'hsl(150 70% 60%)' }}>
                  <BadgePercent className="h-[18px] w-[18px]" />
                </div>
                <span>2.5% protocol fee vs 5%+ traditional</span>
              </div>
              <div className="auth-feature" style={{ color: 'hsl(220 15% 80%)' }}>
                <div className="auth-feature-icon" style={{ background: 'hsl(280 60% 50% / 0.2)', color: 'hsl(280 70% 70%)' }}>
                  <Globe className="h-[18px] w-[18px]" />
                </div>
                <span>Multi-chain USDC via Circle Gateway</span>
              </div>
            </div>

            {/* Docs link */}
            <button
              onClick={() => setShowDocs(true)}
              className="mt-8 flex items-center gap-2 text-[14px] font-medium text-white/60 hover:text-white transition-colors group"
            >
              <BookOpen className="h-4 w-4" />
              <span>Read the documentation</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </button>
          </div>

          {/* decorative rings */}
          <div className="auth-ring auth-ring--1" />
          <div className="auth-ring auth-ring--2" />
        </div>

        {/* ─── right: form panel ─── */}
        <div className="auth-form-panel">
          <div className="auth-form-inner">
            {/* mobile logo + tagline */}
            <div className="auth-mobile-logo">
              <img src="/logo.png" alt="AutoPayProtocol" className="auth-mobile-logo-img" />
              <p className="auth-mobile-tagline">
                Subscription payments at half the cost
              </p>
            </div>

            <div className="auth-form-header">
              <h2 className="auth-form-title">Sign in</h2>
              <p className="auth-form-desc">
                Choose your preferred authentication method
              </p>
            </div>

            {/* tab bar */}
            <div className="auth-tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => selectTab(tab.id)}
                    data-active={activeTab === tab.id}
                    className="auth-tab"
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* tab content */}
            <div className="auth-tab-content">
              {activeTab === 'passkey' && (
                <div className="auth-fade-in" key="passkey">
                  <PasskeyLogin />
                </div>
              )}
              {activeTab === 'recovery' && (
                <div className="auth-fade-in" key="recovery">
                  <RecoveryInline onCancel={() => selectTab('passkey')} />
                </div>
              )}
            </div>

            {/* footer — desktop only */}
            <div className="auth-form-footer auth-form-footer--desktop">
              <span className="auth-dot" />
              Secured by AutoPayProtocol
            </div>
          </div>
        </div>
      </div>

      {/* scene footer */}
      <div className="auth-scene-footer" style={{ color: 'hsl(220 15% 60%)' }}>
        {/* "Secured by" on mobile */}
        <div className="auth-scene-footer-secured">
          <span className="auth-dot" />
          Secured by AutoPayProtocol
        </div>
        <div className="auth-scene-footer-meta">
          <span>Arc Testnet</span>
          <div className="auth-footer-dot" style={{ background: 'hsl(220 15% 45%)' }} />
          <span>USDC Payments</span>
          <div className="auth-footer-dot" style={{ background: 'hsl(220 15% 45%)' }} />
          <span>Powered by Circle</span>
        </div>
      </div>
    </div>
  )
}

/* ── inline recovery ─── */

function RecoveryInline({ onCancel }: { onCancel: () => void }) {
  const {
    recoveryStatus,
    recoveredAddress,
    isLoading,
    validateRecoveryPhrase,
    confirmRecovery,
    clearRecovery,
  } = useRecovery()

  const [mnemonic, setMnemonic] = React.useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mnemonic.trim()) validateRecoveryPhrase(mnemonic)
  }

  const handleCancel = () => {
    clearRecovery()
    onCancel()
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[15px] font-semibold text-white mb-1">
          Recover your wallet
        </h3>
        <p className="text-[13px] text-[hsl(220,15%,52%)]">
          Enter your 12-word recovery phrase to regain access
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <TextArea
          value={mnemonic}
          onChange={(e) => setMnemonic(e.target.value)}
          placeholder="word1 word2 word3 ..."
          className="min-h-[88px] text-sm"
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={!mnemonic.trim() || isLoading} className="flex-1">
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Validating...</>
            ) : (
              'Validate Phrase'
            )}
          </Button>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </form>

      {recoveredAddress && (
        <Alert variant="success">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Account found!</AlertTitle>
          <AlertDescription className="space-y-3">
            <div>
              <span className="font-medium">Address:</span>
              <code className="block mt-1 text-xs font-mono break-all bg-success/10 p-2 rounded">
                {recoveredAddress}
              </code>
            </div>
            <p className="text-sm">Click below to create a new passkey for this wallet.</p>
            <Button variant="success" onClick={confirmRecovery} disabled={isLoading} className="w-full">
              {isLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Recovering...</>
              ) : (
                'Confirm Recovery'
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <StatusMessage
        message={recoveryStatus}
        type={
          recoveryStatus.startsWith('Invalid') || recoveryStatus.startsWith('Recovery failed')
            ? 'error' : 'info'
        }
      />
    </div>
  )
}
