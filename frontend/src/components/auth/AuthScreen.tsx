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

  if (showDocs) {
    return (
      <div className="flex h-screen flex-col bg-background overflow-hidden">
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
        <div className="flex-1 min-h-0 overflow-hidden">
          <DocsPage />
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'passkey' as const, label: 'Passkey', icon: Fingerprint },
    { id: 'recovery' as const, label: 'Restore', icon: KeyRound },
  ]

  return (
    <div className="auth-scene">
      <div className="auth-grid" />

      <div className="auth-split">
        {/* ─── left: brand panel ─── */}
        <div className="auth-brand">
          <div className="auth-brand-content">
            <img
              src="/logo.png"
              alt="AutoPayProtocol"
              className="auth-brand-logo auth-stagger auth-stagger-1"
            />
            <h1 className="auth-brand-headline auth-stagger auth-stagger-2">
              Cut your payment
              <br />
              fees in half
            </h1>
            <p className="auth-brand-sub auth-stagger auth-stagger-3">
              Recurring USDC payments for newsletters, DAOs, and SaaS. Just 2.5% per transaction.
            </p>

            <div className="auth-brand-features auth-stagger auth-stagger-4">
              <div className="auth-feature">
                <div className="auth-feature-icon auth-feature-icon--wallet">
                  <Wallet className="h-4 w-4" />
                </div>
                <span>Non-custodial — funds stay in user wallets</span>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon auth-feature-icon--fee">
                  <BadgePercent className="h-4 w-4" />
                </div>
                <span>2.5% protocol fee vs 5%+ traditional</span>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon auth-feature-icon--chain">
                  <Globe className="h-4 w-4" />
                </div>
                <span>Multi-chain USDC via Circle Gateway</span>
              </div>
            </div>

            <button
              onClick={() => setShowDocs(true)}
              className="auth-docs-link auth-stagger auth-stagger-5"
            >
              <BookOpen className="h-4 w-4" />
              Documentation
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
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
          <span>Arc Testnet</span>
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
        <h3 className="text-[15px] font-semibold text-white mb-1">
          Recover your wallet
        </h3>
        <p className="text-[13px] text-[hsl(220,15%,55%)]">
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
