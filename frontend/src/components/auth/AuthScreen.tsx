import * as React from 'react'
import { ConnectWallet } from './ConnectWallet'
import {
  Wallet,
  BadgePercent,
  Globe,
  BookOpen,
  ArrowRight,
  Shield,
  Zap,
  ExternalLink,
  Trophy,
} from 'lucide-react'
import { EmailCaptureDialog, useEmailCaptureDialog } from '../EmailCaptureDialog'

export function AuthScreen({ onNavigateDocs }: { onNavigateDocs?: () => void }) {
  const emailCapture = useEmailCaptureDialog()

  return (
    <div className="auth-scene">
      <div className="auth-grid" />

      <div className="auth-split">
        {/* payment stream bridge */}
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

        {/* left: brand panel */}
        <div className="auth-brand">
          <div className="auth-aurora" aria-hidden="true">
            <div className="auth-orb auth-orb--1" />
            <div className="auth-orb auth-orb--2" />
            <div className="auth-orb auth-orb--3" />
            <div className="auth-grain" />
          </div>
          <div className="auth-brand-content">
            <div className="auth-brand-topbar auth-stagger auth-stagger-1">
              <img
                src="/logo.png"
                alt="AutoPayProtocol"
                className="auth-brand-logo"
              />
              <div className="auth-finalist-badge hidden">
                <div className="auth-finalist-badge-glow" />
                <Trophy className="h-3 w-3" />
                <span>ETH Global Hack Money Finalist</span>
              </div>
            </div>
            <h1 className="auth-brand-headline auth-stagger auth-stagger-2">
              Cut your payment fees in <strong>half</strong>
            </h1>
            <p className="auth-brand-sub auth-stagger auth-stagger-3">
              Recurring USDC payments for newsletters, DAOs, and SaaS.
            </p>

            <div className="auth-bento auth-stagger auth-stagger-4">
              <div className="auth-bento-card">
                <span className="auth-bento-value">50%</span>
                <span className="auth-bento-label">cheaper fees</span>
              </div>
              <div className="auth-bento-card">
                <span className="auth-bento-value">Flow</span>
                <span className="auth-bento-label">EVM powered</span>
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
                <span>Flow EVM with any browser wallet</span>
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
              <button
                onClick={() => emailCapture.setOpen(true)}
                className="auth-waitlist-cta"
              >
                <span>Early Access</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* mobile: hero section */}
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
                <span>Flow EVM</span>
              </div>
            </div>
          </div>
          <div className="auth-mobile-tokens">
            <div className="auth-mp auth-mp--1" />
            <div className="auth-mp auth-mp--2" />
            <div className="auth-mp auth-mp--3" />
            <div className="auth-mp auth-mp--4" />
            <div className="auth-mp auth-mp--5" />
          </div>
        </div>

        {/* right: form panel */}
        <div className="auth-form-panel">
          <div className="auth-form-inner auth-card-enter">
            <div className="auth-mobile-logo">
              <img src="/logo.png" alt="AutoPayProtocol" className="auth-mobile-logo-img" />
              <p className="auth-mobile-tagline">
                Cut your payment fees in half
              </p>
            </div>

            <div className="auth-form-icon-ring">
              <div className="auth-form-icon-ring-outer" />
              <div className="auth-form-icon-ring-inner">
                <Wallet className="h-6 w-6 text-blue-600" />
              </div>
            </div>

            <div className="auth-form-header">
              <h2 className="auth-form-title">Connect Wallet</h2>
              <p className="auth-form-desc">
                Link your wallet to start managing subscriptions
              </p>
            </div>

            <div className="auth-tab-content">
              <div className="auth-fade-in" key="connect">
                <ConnectWallet />
              </div>
            </div>

            <div className="auth-form-trust">
              <div className="auth-form-trust-row">
                <div className="auth-form-trust-item">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Non-custodial</span>
                </div>
                <div className="auth-form-trust-sep" />
                <div className="auth-form-trust-item">
                  <Zap className="h-3.5 w-3.5" />
                  <span>Gasless</span>
                </div>
                <div className="auth-form-trust-sep" />
                <div className="auth-form-trust-item">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Multi-chain</span>
                </div>
              </div>
            </div>

            <div className="auth-form-footer auth-form-footer--desktop">
              <span className="auth-dot" />
              Secured by AutoPayProtocol
            </div>
          </div>
        </div>
      </div>

      <div className="auth-scene-footer">
        <div className="auth-scene-footer-secured">
          <span className="auth-dot" />
          Secured by AutoPayProtocol
        </div>
        <div className="auth-scene-footer-meta">
          <span><span className="auth-chain-dot" />Flow EVM</span>
          <div className="auth-footer-dot" />
          <span>USDC Payments</span>
        </div>
      </div>

      <EmailCaptureDialog open={emailCapture.open} onOpenChange={emailCapture.setOpen} />
    </div>
  )
}
