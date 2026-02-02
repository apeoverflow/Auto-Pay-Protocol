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
  Shield,
  Zap,
  RefreshCw,
} from 'lucide-react'

type AuthTab = 'passkey' | 'recovery'

export function AuthScreen() {
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
              Automated on-chain
              <br />
              subscription payments
            </h1>
            <p className="auth-brand-sub">
              Set up recurring USDC payments with smart contract security.
              No intermediaries, no missed payments.
            </p>

            <div className="auth-brand-features">
              <div className="auth-feature">
                <div className="auth-feature-icon">
                  <Shield className="h-[18px] w-[18px]" />
                </div>
                <span>Smart contract secured</span>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon">
                  <Zap className="h-[18px] w-[18px]" />
                </div>
                <span>Instant USDC transfers</span>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon">
                  <RefreshCw className="h-[18px] w-[18px]" />
                </div>
                <span>Automated recurring billing</span>
              </div>
            </div>
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
                Automated on-chain subscription payments
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
      <div className="auth-scene-footer">
        {/* "Secured by" on mobile */}
        <div className="auth-scene-footer-secured">
          <span className="auth-dot" />
          Secured by AutoPayProtocol
        </div>
        <div className="auth-scene-footer-meta">
          <span>Polygon Amoy Testnet</span>
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
