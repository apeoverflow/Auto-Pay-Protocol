import * as React from 'react'
import { useRecovery } from '../../hooks'
import { Button } from '../ui/button'
import { TextArea } from '../ui/input'
import { Alert, AlertTitle, AlertDescription } from '../ui/alert'
import { StatusMessage } from '../common/StatusMessage'
import { PasskeyLogin } from './PasskeyLogin'
import { RecoveryScreen } from '../recovery/RecoveryScreen'
import {
  Fingerprint,
  KeyRound,
  CheckCircle,
  Loader2,
  Wallet,
  BadgePercent,
  Globe,
  BookOpen,
  ArrowRight,
  Shield,
  Zap,
  ExternalLink,
} from 'lucide-react'

type AuthTab = 'passkey' | 'recovery'

export function AuthScreen({ onNavigateDocs }: { onNavigateDocs?: () => void }) {
  const { showRecovery, setShowRecovery } = useRecovery()
  const [activeTab, setActiveTab] = React.useState<AuthTab>('passkey')

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

  const tabs = [
    { id: 'passkey' as const, label: 'Passkey', icon: Fingerprint },
    { id: 'recovery' as const, label: 'Restore', icon: KeyRound },
  ]

  return (
    <div className="auth-scene">
      <div className="auth-grid" />

      <div className="auth-split">
        {/* ─── payment stream bridge ─── */}
        <div className="auth-stream" aria-hidden="true">
          <div className="auth-stream-rail" />
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <React.Fragment key={n}>
              <div className={`auth-token auth-token--${n}`} />
              <div className={`auth-token auth-token--${n} auth-seg auth-seg--1`} />
              <div className={`auth-token auth-token--${n} auth-seg auth-seg--2`} />
              <div className={`auth-token auth-token--${n} auth-seg auth-seg--3`} />
              <div className={`auth-token auth-token--${n} auth-seg auth-seg--4`} />
              <div className={`auth-token auth-token--${n} auth-seg auth-seg--5`} />
              <div className={`auth-token auth-token--${n} auth-seg auth-seg--6`} />
            </React.Fragment>
          ))}
        </div>

        {/* ─── left: brand panel ─── */}
        <div className="auth-brand">
          {/* ambient aurora */}
          <div className="auth-aurora" aria-hidden="true">
            <div className="auth-orb auth-orb--1" />
            <div className="auth-orb auth-orb--2" />
            <div className="auth-orb auth-orb--3" />
            <div className="auth-grain" />
          </div>
          <div className="auth-brand-content">
            <img
              src="/logo.png"
              alt="AutoPayProtocol"
              className="auth-brand-logo auth-stagger auth-stagger-1"
            />
            <h1 className="auth-brand-headline auth-stagger auth-stagger-2">
              Cut your payment fees in <strong>half</strong>
            </h1>
            <p className="auth-brand-sub auth-stagger auth-stagger-3">
              Recurring USDC payments for newsletters, DAOs, and SaaS.
            </p>

            {/* micro-stats */}
            <div className="auth-bento auth-stagger auth-stagger-4">
              <div className="auth-bento-card">
                <span className="auth-bento-value">50%</span>
                <span className="auth-bento-label">cheaper fees</span>
              </div>
              <div className="auth-bento-card">
                <span className="auth-bento-value">12+</span>
                <span className="auth-bento-label">chains supported</span>
              </div>
            </div>

            <div className="auth-brand-features auth-stagger auth-stagger-5">
              <div className="auth-feature">
                <div className="auth-feature-icon auth-feature-icon--wallet">
                  <Wallet className="h-4 w-4" />
                </div>
                <span>Non-custodial — full wallet ownership & control</span>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon auth-feature-icon--fee">
                  <BadgePercent className="h-4 w-4" />
                </div>
                <span>No intermediaries or hidden processing fees</span>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon auth-feature-icon--chain">
                  <Globe className="h-4 w-4" />
                </div>
                <span>Multi-chain USDC via Circle Gateway</span>
              </div>
            </div>

            <div className="auth-links-row auth-stagger auth-stagger-6">
              <button
                onClick={() => onNavigateDocs?.()}
                className="auth-docs-link"
              >
                <BookOpen className="h-4 w-4" />
                Documentation
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <a
                href="https://merchant-checkout-demo-production.up.railway.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="auth-docs-link"
              >
                <ExternalLink className="h-4 w-4" />
                Live Demo
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* ─── mobile: hero section (hidden on desktop) ─── */}
        <div className="auth-mobile-hero" aria-hidden="true">
          <div className="auth-mobile-hero-aurora">
            <div className="auth-mobile-orb auth-mobile-orb--1" />
            <div className="auth-mobile-orb auth-mobile-orb--2" />
            <div className="auth-mobile-orb auth-mobile-orb--3" />
          </div>
          <div className="auth-mobile-hero-content">
            <img
              src="/logo.png"
              alt="AutoPayProtocol"
              className="auth-mobile-hero-logo auth-m-stagger auth-m-stagger-1"
            />
            <h1 className="auth-mobile-hero-headline auth-m-stagger auth-m-stagger-2">
              Cut fees in <strong>half</strong>
            </h1>
            <p className="auth-mobile-hero-sub auth-m-stagger auth-m-stagger-3">
              Recurring USDC payments for newsletters, DAOs, and SaaS.
            </p>
            <div className="auth-mobile-hero-pills auth-m-stagger auth-m-stagger-4">
              <div className="auth-mobile-pill">
                <Zap className="auth-mobile-pill-icon" />
                <span>Non-custodial</span>
              </div>
              <div className="auth-mobile-pill">
                <Shield className="auth-mobile-pill-icon" />
                <span>50% cheaper</span>
              </div>
              <div className="auth-mobile-pill">
                <Globe className="auth-mobile-pill-icon" />
                <span>Multi-chain</span>
              </div>
            </div>
          </div>
          {/* mobile floating tokens */}
          <div className="auth-mobile-tokens">
            <div className="auth-mp auth-mp--1" />
            <div className="auth-mp auth-mp--2" />
            <div className="auth-mp auth-mp--3" />
            <div className="auth-mp auth-mp--4" />
            <div className="auth-mp auth-mp--5" />
          </div>
        </div>

        {/* ─── right: form panel ─── */}
        <div className="auth-form-panel">
          <div className="auth-form-inner auth-card-enter">
            <div className="auth-mobile-logo">
              <img src="/logo.png" alt="AutoPayProtocol" className="auth-mobile-logo-img" />
              <p className="auth-mobile-tagline">
                Cut your payment fees in half
              </p>
            </div>

            <div className="auth-form-header">
              <h2 className="auth-form-title">Sign in</h2>
              <p className="auth-form-desc">
                Access your wallet to continue
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
      <div className="auth-scene-footer">
        <div className="auth-scene-footer-secured">
          <span className="auth-dot" />
          Secured by AutoPayProtocol
        </div>
        <div className="auth-scene-footer-meta">
          <span><span className="auth-chain-dot" />Arc Testnet</span>
          <div className="auth-footer-dot" />
          <span>USDC Payments</span>
          <div className="auth-footer-dot" />
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
        <h3 className="text-[15px] font-semibold text-gray-900 mb-1">
          Recover your wallet
        </h3>
        <p className="text-[13px] text-gray-500">
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
