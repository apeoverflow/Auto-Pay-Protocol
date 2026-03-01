import { useRef } from 'react'
import {
  ShieldCheck,
  BadgePercent,
  ArrowRight,
  BookOpen,
  ArrowUpRight,
  Check,
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  Github,
  Package,
  LayoutDashboard,
  Link2,
  Wallet,
  Webhook,
} from 'lucide-react'
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  useSpring,
  animate,
  useReducedMotion,
} from 'framer-motion'
import type { Variants, HTMLMotionProps } from 'framer-motion'
import { useEffect, useState } from 'react'

interface LandingPageProps {
  onOpenApp: () => void
  onDocs: () => void
}

/* ── shared animation variants ── */
const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
}

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', damping: 14, stiffness: 140 },
  },
}

const heroTextVariants: Variants = {
  hidden: { opacity: 0, y: 48 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', damping: 12, stiffness: 140 },
  },
}

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 24 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', damping: 14, stiffness: 140 },
  },
}

/* ── SectionReveal wrapper ── */
function SectionReveal({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const prefersReduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      style={style}
      variants={containerVariants}
      initial={prefersReduced ? 'visible' : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, amount: 0.08 }}
    >
      {children}
    </motion.div>
  )
}

/* ── Motion button with spring hover/tap ── */
function MotionButton({
  children,
  className,
  onClick,
  ...rest
}: HTMLMotionProps<'button'> & { onClick?: () => void }) {
  const prefersReduced = useReducedMotion()
  return (
    <motion.button
      className={className}
      onClick={onClick}
      whileHover={prefersReduced ? {} : { scale: 1.03, y: -2 }}
      whileTap={prefersReduced ? {} : { scale: 0.97 }}
      transition={{ type: 'spring', damping: 14, stiffness: 200 }}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

/* ── USDC coin SVG ── */
function UsdcCoin({ size }: { size: number }) {
  return (
    <img
      src="/logos/usdc.svg"
      alt=""
      width={size}
      height={size}
      style={{ borderRadius: '50%', display: 'block' }}
    />
  )
}

/* ── USDC stream (arc paths — branch at top) ── */
/* edge: conic-gradient start angle, tiltX/tiltY: subtle perspective tilt matching shadow direction */
const ARC_COINS: { size: number; dur: number; spread: number; wobble: number; path: number; edge: number; tiltX: number; tiltY: number }[] = [
  { size: 30, dur: 8, spread: -8, wobble: 24, path: 0, edge: 145, tiltX: 18, tiltY: -14 },
  { size: 26, dur: 12, spread: 10, wobble: 29, path: 1, edge: 200, tiltX: -15, tiltY: -16 },
  { size: 34, dur: 6, spread: -4, wobble: 26, path: 2, edge: 170, tiltX: 14, tiltY: -10 },
]

function UsdcStream() {
  return (
    <div className="lp-usdc-stream" aria-hidden="true">
      <div className="lp-mist lp-mist-2" />
      <div className="lp-mist lp-mist-3" />
      <div className="lp-mist lp-mist-5" />
      <div className="lp-tendril lp-tendril-1" />
      <div className="lp-tendril lp-tendril-3" />
      <div className="lp-shimmer lp-shimmer-firefly lp-arc-1"><div className="lp-shimmer-core" /></div>
      <div className="lp-shimmer lp-shimmer-streak lp-arc-2"><div className="lp-shimmer-core" /></div>
      {ARC_COINS.map((c, i) => (
        <div
          key={i}
          className={`lp-coin lp-arc-${c.path}`}
          style={{
            ['--dur' as string]: `${c.dur}s`,
            ['--delay' as string]: `${-((i / ARC_COINS.length) * c.dur).toFixed(1)}s`,
            ['--spread' as string]: `${c.spread}px`,
          }}
        >
          <div
            className="lp-coin-body"
            style={{
              width: c.size,
              height: c.size,
              animationDuration: `${c.wobble}s`,
            }}
          >
            <UsdcCoin size={c.size} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── animated counter (framer-motion animate) ── */
function Counter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    if (!inView) return
    if (prefersReduced) {
      setVal(end)
      return
    }
    const controls = animate(0, end, {
      duration: 1.4,
      ease: [0, 0, 0.2, 1],
      onUpdate: (v) => setVal(Math.round(v * 10) / 10),
    })
    return () => controls.stop()
  }, [inView, end, prefersReduced])

  return (
    <span ref={ref}>
      {val % 1 === 0 ? val : val.toFixed(1)}
      {suffix}
    </span>
  )
}

/* ── Hero Cards with mouse-tracking parallax ── */
function HeroCards() {
  const containerRef = useRef<HTMLDivElement>(null)
  const prefersReduced = useReducedMotion()

  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)

  const springConfig = { damping: 20, stiffness: 120 }
  const rotateY = useSpring(useTransform(mouseX, [0, 1], [-4, 4]), springConfig)
  const rotateX = useSpring(useTransform(mouseY, [0, 1], [4, -4]), springConfig)

  const handleMouse = (e: React.MouseEvent) => {
    if (prefersReduced) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    mouseX.set((e.clientX - rect.left) / rect.width)
    mouseY.set((e.clientY - rect.top) / rect.height)
  }

  const handleLeave = () => {
    mouseX.set(0.5)
    mouseY.set(0.5)
  }

  return (
    <motion.div
      ref={containerRef}
      className="lp-hero-cards"
      style={prefersReduced ? {} : { rotateX, rotateY }}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
    >
      {/* Card 3 — Wallet Balance (back) */}
      <div className="lp-hero-card lp-hero-card-3">
        <div className="lp-hc-header">
          <div className="lp-hc-icon-wrap lp-hc-icon-neutral">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3.5" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.4"/><circle cx="11" cy="9.5" r="1" fill="currentColor"/></svg>
          </div>
          <span className="lp-hc-name">Connected Wallet</span>
        </div>
        <div className="lp-hc-amount-lg">$432.00 <span className="lp-hc-unit">USDC</span></div>
        <div className="lp-hc-row"><span className="lp-hc-label">Address</span><span className="lp-hc-value lp-hc-mono">0x71C7...9a3F</span></div>
        <div className="lp-hc-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <span className="lp-hc-label">Network</span>
          <span className="lp-hc-chain-pill">
            <span className="lp-hc-chain-dot" />
            Flow EVM
          </span>
        </div>
      </div>

      {/* Card 2 — Charge Receipt (middle) */}
      <div className="lp-hero-card lp-hero-card-2">
        <div className="lp-hc-header">
          <div className="lp-hc-icon-wrap lp-hc-icon-green">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3.5 7.5L5.5 9.5L10.5 4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span className="lp-hc-name">Payment Successful</span>
        </div>
        <div className="lp-hc-amount-lg lp-hc-amount-receipt">$49.00 <span className="lp-hc-unit">USDC</span></div>
        <div className="lp-hc-row"><span className="lp-hc-label">To</span><span className="lp-hc-value">nexusai.eth</span></div>
        <div className="lp-hc-row"><span className="lp-hc-label">Tx</span><span className="lp-hc-value lp-hc-mono">0x3f8a...c2d1</span></div>
        <div className="lp-hc-timestamp">Feb 28, 2026 · 14:32 UTC</div>
      </div>

      {/* Card 1 — Active Subscription (front) with pulsing blue glow */}
      <motion.div
        className="lp-hero-card lp-hero-card-1"
        animate={prefersReduced ? {} : {
          boxShadow: [
            '0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,82,255,0.04)',
            '0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.09), 0 0 24px rgba(0,82,255,0.12)',
            '0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,82,255,0.04)',
          ],
        }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="lp-hc-accent-edge" />
        <div className="lp-hc-header">
          <div className="lp-hc-robot-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="8" width="16" height="12" rx="3" fill="var(--blue)" />
              <rect x="6" y="11" width="4" height="3" rx="1" fill="#fff" />
              <rect x="14" y="11" width="4" height="3" rx="1" fill="#fff" />
              <rect x="9" y="16" width="6" height="1.5" rx="0.75" fill="rgba(255,255,255,0.6)" />
              <rect x="10" y="4" width="4" height="5" rx="2" fill="var(--blue)" />
              <circle cx="12" cy="3.5" r="1.5" fill="var(--blue)" />
              <rect x="1" y="12" width="3" height="2" rx="1" fill="var(--blue)" opacity="0.6" />
              <rect x="20" y="12" width="3" height="2" rx="1" fill="var(--blue)" opacity="0.6" />
            </svg>
          </div>
          <span className="lp-hc-name">NexusAI Pro</span>
          <span className="lp-hc-badge"><span className="lp-hc-badge-dot" />Active</span>
        </div>
        <div className="lp-hc-amount-xl">$49.00 <span className="lp-hc-period">/ month</span></div>
        <div className="lp-hc-progress-section">
          <div className="lp-hc-progress-track">
            <div className="lp-hc-progress-fill" style={{ width: '33%' }} />
          </div>
          <div className="lp-hc-progress-meta">
            <span>$196 of $588</span>
            <span>33%</span>
          </div>
        </div>
        <div className="lp-hc-divider" />
        <div className="lp-hc-footer-row">
          <span className="lp-hc-footer-label">Next charge</span>
          <span className="lp-hc-footer-value">Mar 15, 2026</span>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ── TiltCard with per-card mouse tracking ── */
function TiltCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const prefersReduced = useReducedMotion()
  const x = useMotionValue(0.5)
  const y = useMotionValue(0.5)

  const springCfg = { damping: 20, stiffness: 160 }
  const rotateX = useSpring(useTransform(y, [0, 1], [2, -2]), springCfg)
  const rotateY = useSpring(useTransform(x, [0, 1], [-2, 2]), springCfg)

  const handleMouse = (e: React.MouseEvent) => {
    if (prefersReduced) return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    x.set((e.clientX - rect.left) / rect.width)
    y.set((e.clientY - rect.top) / rect.height)
  }

  const handleLeave = () => {
    x.set(0.5)
    y.set(0.5)
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={cardVariants}
      style={prefersReduced ? {} : { rotateX, rotateY, transformPerspective: 800 }}
      whileHover={prefersReduced ? {} : { y: -2, boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}
      transition={{ type: 'spring', damping: 14, stiffness: 160 }}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
    >
      {children}
    </motion.div>
  )
}

/* ── Interactive Fee Calculator ── */
const FEE_PRESETS = [500, 1000, 2500, 5000, 10000]

function FeeCalculator() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.2 })
  const prefersReduced = useReducedMotion()
  const [subs, setSubs] = useState(1000)
  const price = 10
  const [hasInteracted, setHasInteracted] = useState(false)

  const monthly = subs * price
  const platformCut = monthly * 0.08
  const stripeCut = subs * 0.30 + monthly * 0.029
  const tradKeeps = monthly - platformCut - stripeCut
  const autoPayFee = monthly * 0.025
  const autoKeeps = monthly - autoPayFee
  const monthlyDiff = autoKeeps - tradKeeps
  const yearlyDiff = monthlyDiff * 12
  const tradPct = (tradKeeps / monthly) * 100
  const autoPct = (autoKeeps / monthly) * 100

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 })

  return (
    <div ref={ref} className="lp-calc">
      <div className="lp-calc-controls">
        <div className="lp-calc-label">
          <span className="lp-calc-label-text">Subscribers</span>
          <motion.span className="lp-calc-label-val" key={subs} initial={hasInteracted ? { scale: 1.15 } : {}} animate={{ scale: 1 }}>{subs.toLocaleString()}</motion.span>
        </div>
        <div className="lp-calc-slider-wrap">
          <input type="range" min={100} max={25000} step={100} value={subs}
            onChange={(e) => { setSubs(Number(e.target.value)); setHasInteracted(true) }}
            className="lp-calc-slider" />
          <div className="lp-calc-slider-fill" style={{ width: `${((subs - 100) / (25000 - 100)) * 100}%` }} />
        </div>
        <div className="lp-calc-presets">
          {FEE_PRESETS.map((p) => (
            <button key={p} className={`lp-calc-preset ${subs === p ? 'lp-calc-preset--active' : ''}`}
              onClick={() => { setSubs(p); setHasInteracted(true) }}>
              {p >= 1000 ? `${p / 1000}k` : p}
            </button>
          ))}
        </div>
      </div>

      <div className="lp-calc-race">
        <div className="lp-calc-race-label">At ${price}/mo each — who keeps more?</div>
        <div className="lp-calc-bar-group">
          <div className="lp-calc-bar-label">
            <span>Patreon + Stripe</span>
            <span className="lp-calc-bar-amount lp-calc-bar-amount--trad">${fmt(tradKeeps)}</span>
          </div>
          <div className="lp-calc-bar-track">
            <motion.div className="lp-calc-bar-fill lp-calc-bar-fill--trad"
              initial={prefersReduced ? { width: `${tradPct}%` } : { width: '0%' }}
              animate={inView ? { width: `${tradPct}%` } : {}}
              transition={{ type: 'spring', damping: 20, stiffness: 120 }} />
            <div className="lp-calc-bar-drain" style={{ left: `${tradPct}%`, width: `${100 - tradPct}%` }} />
          </div>
          <div className="lp-calc-bar-fees">
            <span className="lp-calc-fee-chip">−${fmt(platformCut)} platform</span>
            <span className="lp-calc-fee-chip">−${fmt(stripeCut)} processing</span>
          </div>
        </div>
        <div className="lp-calc-bar-group">
          <div className="lp-calc-bar-label">
            <span>AutoPay</span>
            <span className="lp-calc-bar-amount lp-calc-bar-amount--auto">${fmt(autoKeeps)}</span>
          </div>
          <div className="lp-calc-bar-track">
            <motion.div className="lp-calc-bar-fill lp-calc-bar-fill--auto"
              initial={prefersReduced ? { width: `${autoPct}%` } : { width: '0%' }}
              animate={inView ? { width: `${autoPct}%` } : {}}
              transition={{ type: 'spring', damping: 20, stiffness: 120, delay: 0.1 }} />
          </div>
          <div className="lp-calc-bar-fees">
            <span className="lp-calc-fee-chip lp-calc-fee-chip--blue">−${fmt(autoPayFee)} flat 2.5%</span>
          </div>
        </div>
      </div>

      <motion.div className="lp-calc-savings" animate={hasInteracted ? { scale: [1, 1.04, 1] } : {}} transition={{ duration: 0.3 }} key={subs}>
        <div className="lp-calc-savings-top">
          <span className="lp-calc-savings-plus">+</span>
          <span className="lp-calc-savings-amount">${fmt(yearlyDiff)}</span>
          <span className="lp-calc-savings-per">/yr</span>
        </div>
        <div className="lp-calc-savings-yearly">
          That's <strong>${fmt(monthlyDiff)}/mo</strong> more in your pocket
        </div>
      </motion.div>
    </div>
  )
}

/* ── Deplatforming Case Studies ── */
const DEPLATFORM_CASES = [
  {
    entity: 'OnlyFans',
    year: '2021',
    event: 'Mastercard forced a ban on explicit content. 2M creators, $5B+ in annual earnings threatened. Reversed in 6 days — but the power was demonstrated.',
    source: 'OnlyFans public statement, Aug 2021',
  },
  {
    entity: 'Patreon',
    year: '2018',
    event: 'Banned a creator for speech on a different platform. Sam Harris left in protest — walking away from $100K+/mo in recurring revenue.',
    source: 'Sam Harris public statement, Dec 2018',
  },
  {
    entity: 'PayPal',
    year: '2022',
    event: 'Published a policy allowing $2,500 fines for "misinformation." Retracted after backlash — but it was in the official terms.',
    source: 'PayPal AUP update, Oct 2022',
  },
]

function DeplatformCases() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.2 })
  const prefersReduced = useReducedMotion()

  return (
    <div ref={ref} className="lp-deplat">
      {/* Cases */}
      <div className="lp-deplat-list">
        {DEPLATFORM_CASES.map((c, i) => (
          <motion.div
            key={c.entity}
            className="lp-deplat-row"
            initial={prefersReduced ? {} : { opacity: 0, x: -10 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ type: 'spring', damping: 16, stiffness: 160, delay: i * 0.08 }}
          >
            <div className="lp-deplat-row-head">
              <span className="lp-deplat-entity">{c.entity}</span>
              <span className="lp-deplat-year">{c.year}</span>
            </div>
            <div className="lp-deplat-event">{c.event}</div>
            <div className="lp-deplat-source">{c.source}</div>
          </motion.div>
        ))}
      </div>

      <div className="lp-deplat-point">
        Every one of these was legal. Every one was a policy decision by a third party that controlled the payment rail.
      </div>

      {/* AutoPay contrast */}
      <motion.div
        className="lp-deplat-fix"
        initial={prefersReduced ? {} : { opacity: 0, y: 12 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ type: 'spring', damping: 14, stiffness: 140, delay: 0.4 }}
      >
        <div className="lp-deplat-fix-icon"><Check size={18} strokeWidth={3} /></div>
        <div className="lp-deplat-fix-text">
          <span className="lp-deplat-fix-title">Smart contracts don't have policy departments</span>
          <span className="lp-deplat-fix-desc">Once deployed, your subscription logic runs until you decide otherwise. No one can change the terms.</span>
        </div>
      </motion.div>
    </div>
  )
}

/* ── Step visual vignettes ── */
function StepVisual({ type }: { type: 'dashboard' | 'link' | 'wallet' | 'webhook' }) {
  if (type === 'dashboard') return (
    <div className="lp-sv lp-sv-dash">
      <div className="lp-sv-dash-row">
        <span className="lp-sv-dash-label">Plan name</span>
        <span className="lp-sv-dash-val">Pro Monthly</span>
      </div>
      <div className="lp-sv-dash-row">
        <span className="lp-sv-dash-label">Price</span>
        <span className="lp-sv-dash-val lp-sv-dash-price">$49.00 <small>USDC</small></span>
      </div>
      <div className="lp-sv-dash-row">
        <span className="lp-sv-dash-label">Interval</span>
        <span className="lp-sv-dash-val">Monthly</span>
      </div>
      <div className="lp-sv-dash-btn">Publish Plan</div>
    </div>
  )
  if (type === 'link') return (
    <div className="lp-sv lp-sv-link">
      <div className="lp-sv-link-bar">
        <span className="lp-sv-link-url">autopayprotocol.com/checkout/pro-monthly</span>
        <span className="lp-sv-link-copy">Copy</span>
      </div>
      <div className="lp-sv-link-or">or embed</div>
      <div className="lp-sv-link-code">{'<a href="…">Subscribe</a>'}</div>
    </div>
  )
  if (type === 'wallet') return (
    <div className="lp-sv lp-sv-wallet">
      <div className="lp-sv-wallet-top">
        <div className="lp-sv-wallet-dot" />
        <span className="lp-sv-wallet-addr">0x71C7…9a3F</span>
        <span className="lp-sv-wallet-badge">Connected</span>
      </div>
      <div className="lp-sv-wallet-amount">$49.00 <small>USDC</small></div>
      <div className="lp-sv-wallet-chains">
        <span>Base</span><span>Flow</span><span>Arbitrum</span><span>+27</span>
      </div>
      <div className="lp-sv-wallet-btn">Pay Now</div>
    </div>
  )
  return (
    <div className="lp-sv lp-sv-hook">
      <pre className="lp-sv-hook-pre">
        <span className="lp-syn-method">POST</span>{' '}<span className="lp-syn-url">/webhooks</span>{'\n'}
        <span className="lp-syn-brace">{'{'}</span>{'\n'}
        {'  '}<span className="lp-syn-key">"event"</span><span className="lp-syn-colon">:</span> <span className="lp-syn-str">"charge.succeeded"</span><span className="lp-syn-comma">,</span>{'\n'}
        {'  '}<span className="lp-syn-key">"amount"</span><span className="lp-syn-colon">:</span> <span className="lp-syn-str">"49.00"</span><span className="lp-syn-comma">,</span>{'\n'}
        {'  '}<span className="lp-syn-key">"payer"</span><span className="lp-syn-colon">:</span> <span className="lp-syn-str">"0x71C7…9a3F"</span>{'\n'}
        <span className="lp-syn-brace">{'}'}</span>
      </pre>
    </div>
  )
}

/* StepCard is now inlined in the JSX for the staggered layout */

/* ── data ── */

const ROWS = [
  { label: 'Fee', us: '2.5% flat', them: '2.9% + 30c' },
  { label: 'Deplatforming', us: 'Impossible', them: 'One policy change away' },
  { label: 'Settlement', us: 'Instant, on-chain', them: '2–7 business days' },
  { label: 'Geography', us: 'Any wallet, any country', them: 'Bank account required' },
  { label: 'Custody', us: 'Subscriber\'s wallet', them: 'Their servers' },
  { label: 'Terms', us: 'Smart contract enforced', them: 'Can change anytime' },
  { label: 'Chargebacks', us: 'None', them: 'Up to 120 days' },
  { label: 'Source code', us: 'Open source', them: 'Proprietary' },
]

/* ── dissolve block generator ── */
function seededRandom(seed: number) {
  let s = seed
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646 }
}

type BlkType = 'dark' | 'outline' | 'fill'

function generateDissolveBlocks() {
  const blocks: { x: number; y: number; w: number; h: number; t: BlkType }[] = []
  const rand = seededRandom(42)

  // zone weights: y-range → count, size-range, dark-probability
  const zones = [
    { yMin: 0, yMax: 12, count: 80, sMin: 4, sMax: 14, darkP: 0.4 },
    { yMin: 10, yMax: 25, count: 100, sMin: 8, sMax: 24, darkP: 0.65 },
    { yMin: 22, yMax: 40, count: 120, sMin: 14, sMax: 36, darkP: 0.8 },
    { yMin: 36, yMax: 55, count: 140, sMin: 20, sMax: 52, darkP: 0.92 },
  ]

  for (const z of zones) {
    for (let i = 0; i < z.count; i++) {
      const x = rand() * 102 - 1 // -1% to 101% for edge coverage
      const y = z.yMin + rand() * (z.yMax - z.yMin)
      const s = z.sMin + rand() * (z.sMax - z.sMin)
      const r = rand()
      const t: BlkType = r < z.darkP ? 'dark' : r < z.darkP + 0.06 ? 'fill' : 'outline'
      blocks.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, w: Math.round(s), h: Math.round(s), t })
    }
  }
  return blocks
}

function generateFallingBlocks() {
  const falls: { x: number; s: number; d: number; dl: number }[] = []
  const rand = seededRandom(99)
  for (let i = 0; i < 24; i++) {
    falls.push({
      x: rand() * 98 + 1,
      s: 8 + Math.round(rand() * 14),
      d: 3.5 + rand() * 3.0,
      dl: rand() * 4.0,
    })
  }
  return falls
}

const DISSOLVE_BLOCKS = generateDissolveBlocks()
const DISSOLVE_FALLS = generateFallingBlocks()

/* falling blocks for left/right gutters of comparison section */
function generateSideFalls() {
  const falls: { x: number; s: number; d: number; dl: number }[] = []
  const rand = seededRandom(55)
  for (let i = 0; i < 36; i++) {
    // alternate left gutter (0-22%) and right gutter (78-100%)
    const side = i % 2 === 0
    const x = side ? rand() * 22 : 78 + rand() * 22
    falls.push({
      x: Math.round(x * 10) / 10,
      s: 6 + Math.round(rand() * 12),
      d: 3.0 + rand() * 3.0,
      dl: rand() * 5.0,
    })
  }
  return falls
}
const CMP_SIDE_FALLS = generateSideFalls()

/* falling edge blocks that cascade from the dissolve into the dark section */
function generateEdgeFalls() {
  const falls: { x: number; s: number; d: number; dl: number }[] = []
  const rand = seededRandom(77)
  for (let i = 0; i < 32; i++) {
    const side = i % 2 === 0
    // left side 0-18%, right side 82-100%
    const x = side ? rand() * 18 : 82 + rand() * 18
    falls.push({
      x: Math.round(x * 10) / 10,
      s: 8 + Math.round(rand() * 16),
      d: 6.0 + rand() * 5.5,
      dl: rand() * 6.0,
    })
  }
  return falls
}
const EDGE_FALLS = generateEdgeFalls()

/* pixel tear: horizontal band of chunky white + blue blocks */
type TearType = 'light' | 'blue-fill' | 'blue-outline'
function generateTearBlocks() {
  const blocks: { x: number; y: number; s: number; t: TearType }[] = []
  const rand = seededRandom(137)
  // uniform dense band across full width
  const rows = [
    { yMin: -5, yMax: 20, count: 30, sMin: 6, sMax: 18, lightP: 0.35 },
    { yMin: 12, yMax: 42, count: 50, sMin: 10, sMax: 28, lightP: 0.45 },
    { yMin: 30, yMax: 70, count: 180, sMin: 12, sMax: 36, lightP: 0.5 },
    { yMin: 58, yMax: 88, count: 50, sMin: 10, sMax: 28, lightP: 0.45 },
    { yMin: 80, yMax: 105, count: 30, sMin: 6, sMax: 18, lightP: 0.35 },
  ]
  for (const row of rows) {
    for (let i = 0; i < row.count; i++) {
      const x = rand() * 104 - 2
      const y = row.yMin + rand() * (row.yMax - row.yMin)
      const s = row.sMin + rand() * (row.sMax - row.sMin)
      const r = rand()
      const t: TearType = r < row.lightP ? 'light' : r < row.lightP + 0.25 ? 'blue-fill' : 'blue-outline'
      blocks.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, s: Math.round(s), t })
    }
  }
  // side drip — extra blocks on left/right that extend above and below
  for (let i = 0; i < 25; i++) {
    const side = rand() < 0.5
    const x = side ? rand() * 18 - 2 : 84 + rand() * 18
    const y = 80 + rand() * 60
    const s = 5 + rand() * 18
    const r = rand()
    const t: TearType = r < 0.3 ? 'light' : r < 0.55 ? 'blue-fill' : 'blue-outline'
    blocks.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, s: Math.round(s), t })
  }
  // side rise — extra blocks on left/right extending above the main band
  for (let i = 0; i < 25; i++) {
    const side = rand() < 0.5
    const x = side ? rand() * 18 - 2 : 84 + rand() * 18
    const y = -60 + rand() * 60
    const s = 5 + rand() * 18
    const r = rand()
    const t: TearType = r < 0.3 ? 'light' : r < 0.55 ? 'blue-fill' : 'blue-outline'
    blocks.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, s: Math.round(s), t })
  }
  return blocks
}
const TEAR_BLOCKS = generateTearBlocks()

/* exit dissolve: dark → light at bottom of dark section */
function generateExitBlocks() {
  const blocks: { x: number; y: number; w: number; h: number; t: BlkType }[] = []
  const rand = seededRandom(31)
  // inverted: light blocks on dark bg, denser at bottom
  const zones = [
    { yMin: 38, yMax: 50, count: 160, sMin: 20, sMax: 52, darkP: 0.95 },
    { yMin: 48, yMax: 62, count: 140, sMin: 14, sMax: 36, darkP: 0.85 },
    { yMin: 60, yMax: 75, count: 100, sMin: 8, sMax: 24, darkP: 0.65 },
    { yMin: 72, yMax: 90, count: 80, sMin: 4, sMax: 14, darkP: 0.4 },
  ]
  for (const z of zones) {
    for (let i = 0; i < z.count; i++) {
      const x = rand() * 102 - 1
      const y = z.yMin + rand() * (z.yMax - z.yMin)
      const s = z.sMin + rand() * (z.sMax - z.sMin)
      const r = rand()
      const t: BlkType = r < z.darkP ? 'dark' : r < z.darkP + 0.06 ? 'fill' : 'outline'
      blocks.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, w: Math.round(s), h: Math.round(s), t })
    }
  }
  return blocks
}
const EXIT_BLOCKS = generateExitBlocks()

const STEPS: { num: string; title: string; desc: string; icon: typeof LayoutDashboard; visual: 'dashboard' | 'link' | 'wallet' | 'webhook' }[] = [
  { num: '01', title: 'Create a Plan', desc: 'Set up a subscription plan in the merchant dashboard — name, price, interval. Takes 30 seconds.', icon: LayoutDashboard, visual: 'dashboard' },
  { num: '02', title: 'Share the Link', desc: 'Copy your checkout link and drop it anywhere — your website, a button, or just send the URL directly.', icon: Link2, visual: 'link' },
  { num: '03', title: 'Subscribers Pay', desc: 'Users connect any wallet and pay with USDC from 30+ chains. First charge is immediate, then recurring.', icon: Wallet, visual: 'wallet' },
  { num: '04', title: 'Webhooks Fire', desc: 'Get real-time POST notifications on every charge, failure, and cancellation. Plug into your existing app logic.', icon: Webhook, visual: 'webhook' },
]

/* ══════════════════════════════════════════════════════ */

export function LandingPage({ onOpenApp, onDocs }: LandingPageProps) {
  const prefersReduced = useReducedMotion()

  return (
    <div className="lp-root">
      {/* dot-grid texture layer */}
      <div className="lp-dot-grid" />

      {/* ── NAV ── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-nav-brand">
            <img src="/logo.png" alt="AutoPay" className="lp-nav-logo" />
          </div>
          <div className="lp-nav-links">
            <button onClick={onDocs} className="lp-nav-link">Docs</button>
            <MotionButton onClick={onOpenApp} className="lp-nav-cta">
              Launch App <ArrowRight size={14} strokeWidth={2.5} />
            </MotionButton>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero">
        {/* Gradient orb */}
        <div className="lp-hero-orb" aria-hidden="true" />
        <UsdcStream />
        <div className="lp-hero-inner">
          <SectionReveal className="lp-hero-text">
            <motion.p variants={heroTextVariants} className="lp-eyebrow">SUBSCRIPTION RAILS YOU OWN</motion.p>
            <motion.h1 variants={heroTextVariants} className="lp-hero-h1">
              Recurring payments{' '}
              <em>no one can shut off</em>
            </motion.h1>
            <motion.p variants={heroTextVariants} className="lp-hero-sub">
              Non-custodial USDC subscriptions across 30+ chains.
              No deplatforming. 50% cheaper than Stripe. Two lines of code.
            </motion.p>
            <motion.div variants={heroTextVariants} className="lp-hero-actions">
              <MotionButton onClick={onOpenApp} className="lp-btn-primary">
                Get Started <ArrowRight size={16} strokeWidth={2.5} />
              </MotionButton>
              <MotionButton onClick={onDocs} className="lp-btn-ghost">
                <BookOpen size={16} /> Documentation
              </MotionButton>
            </motion.div>
          </SectionReveal>
          <motion.div
            className="lp-hero-visual"
            variants={revealVariants}
            initial={prefersReduced ? 'visible' : 'hidden'}
            whileInView="visible"
            viewport={{ once: true, amount: 0.08 }}
          >
            <HeroCards />
          </motion.div>
        </div>

        {/* stat bar */}
        <SectionReveal className="lp-stats-bar">
          <motion.div variants={revealVariants} className="lp-stat">
            <span className="lp-stat-val"><Counter end={2.5} suffix="%" /></span>
            <span className="lp-stat-label">Flat fee</span>
          </motion.div>
          <motion.div variants={revealVariants} className="lp-stat-div" />
          <motion.div variants={revealVariants} className="lp-stat">
            <span className="lp-stat-val"><Counter end={30} suffix="+" /></span>
            <span className="lp-stat-label">Chains</span>
          </motion.div>
          <motion.div variants={revealVariants} className="lp-stat-div" />
          <motion.div variants={revealVariants} className="lp-stat">
            <span className="lp-stat-val">0</span>
            <span className="lp-stat-label">Intermediaries</span>
          </motion.div>
        </SectionReveal>

        {/* ── PARTNERS — ticker tape ── */}
        <div className="lp-partners">
          <div className="lp-ticker-track">
            {[0, 1].map((copy) => (
              <div key={copy} className="lp-ticker-set" aria-hidden={copy === 1 || undefined}>
                {[
                  { src: '/logos/usdc.svg', name: 'USDC' },
                  { src: '/logos/base.svg', name: 'Base' },
                  { src: '/logos/flow.svg', name: 'Flow' },
                  { src: '/logos/lifi.svg', name: 'LI.FI' },
                  { src: '/logos/ipfs.svg', name: 'IPFS' },
                  { src: '/logos/filecoin.svg', name: 'Filecoin' },
                  { src: '/logos/storacha.svg', name: 'Storacha' },
                  { src: '/logos/rainbowkit.svg', name: 'RainbowKit' },
                ].map((p) => (
                  <div key={p.name} className="lp-partner-item">
                    <img src={p.src} alt={p.name} className="lp-partner-logo" />
                    <span className="lp-partner-name">{p.name}</span>
                    <span className="lp-partner-dot" aria-hidden="true" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY AUTOPAY — case studies ── */}
      <section className="lp-section lp-section-tight-bottom">
        <SectionReveal className="lp-contain">
          <motion.p variants={revealVariants} className="lp-eyebrow lp-text-center">WHY AUTOPAY</motion.p>
          <motion.h2 variants={revealVariants} className="lp-h2">
            The numbers{' '}
            <em>speak for themselves</em>
          </motion.h2>

          {/* ── Hero story card: deplatforming ── */}
          <TiltCard className="lp-story-card">
            <div className="lp-story-inner">
              <div className="lp-story-icon">
                <ShieldCheck size={20} strokeWidth={2.5} />
              </div>
              <blockquote className="lp-story-quote">
                "Every subscription platform is a single point of failure.
                One policy change, one compliance decision, one terms-of-service
                update — and a creator is disconnected from their revenue."
              </blockquote>
              <div className="lp-story-stat-row">
                <div className="lp-story-stat">
                  <span className="lp-story-stat-val">0</span>
                  <span className="lp-story-stat-label">Points of failure</span>
                </div>
                <div className="lp-story-stat-div" />
                <div className="lp-story-stat">
                  <span className="lp-story-stat-val">24/7</span>
                  <span className="lp-story-stat-label">Runs on-chain</span>
                </div>
                <div className="lp-story-stat-div" />
                <div className="lp-story-stat">
                  <span className="lp-story-stat-val">You</span>
                  <span className="lp-story-stat-label">Who controls your rails</span>
                </div>
              </div>
              <p className="lp-story-foot">
                Smart contracts don't have compliance departments, ToS updates,
                or payment holds. Once deployed, your subscription logic runs
                until you decide otherwise.
              </p>
            </div>
          </TiltCard>

          {/* ── Two interactive case studies ── */}
          <motion.div className="lp-cases" variants={containerVariants}>
            {/* Left: Interactive fee calculator */}
            <motion.div className="lp-case-card lp-case-fee" variants={cardVariants}>
              <div className="lp-case-card-inner">
                <div className="lp-case-head">
                  <div className="lp-case-icon-wrap lp-case-icon-wrap--blue">
                    <BadgePercent size={14} strokeWidth={2.5} />
                  </div>
                  <span className="lp-case-tag">INTERACTIVE</span>
                </div>
                <h3 className="lp-case-title">
                  How much are you <em>really</em> losing to fees?
                </h3>
                <FeeCalculator />
              </div>
            </motion.div>

            {/* Right: Deplatforming */}
            <motion.div className="lp-case-card lp-case-deplat" variants={cardVariants}>
              <div className="lp-case-card-inner">
                <div className="lp-case-head">
                  <div className="lp-case-icon-wrap lp-case-icon-wrap--red">
                    <ShieldCheck size={14} strokeWidth={2.5} />
                  </div>
                  <span className="lp-case-tag lp-case-tag-red">CASE STUDY</span>
                </div>
                <h3 className="lp-case-title">
                  Your revenue depends on someone else's{' '}
                  <em className="lp-case-em-red">policy decision</em>.
                </h3>
                <DeplatformCases />
              </div>
            </motion.div>
          </motion.div>
        </SectionReveal>
      </section>

      {/* ── pixel dissolve transition ── */}
      <div className="lp-dissolve" aria-hidden="true">
        <div className="lp-dissolve-base" />
        {DISSOLVE_BLOCKS.map((b, i) => (
          <div key={i} className={`lp-blk lp-blk-${b.t}`} style={{ left:`${b.x}%`, top:`${b.y}%`, width:b.w, height:b.h }} />
        ))}
        {DISSOLVE_FALLS.map((f, i) => (
          <div key={`f${i}`} className="lp-blk-fall" style={{ left:`${f.x}%`, width:f.s, height:f.s, animationDuration:`${f.d}s`, animationDelay:`${f.dl}s` }} />
        ))}
      </div>

      {/* ── HOW IT WORKS + COMPARISON (unified dark section) ── */}
      <section className="lp-section lp-section-dark lp-section-unified">
        <div className="lp-dark-aurora" aria-hidden="true">
          <div className="lp-dark-orb lp-dark-orb--1" />
          <div className="lp-dark-orb lp-dark-orb--2" />
          <div className="lp-dark-orb lp-dark-orb--3" />
          <div className="lp-dark-grain" />
        </div>
        {/* falling blue edge blocks cascading into the dark section */}
        <div className="lp-edge-falls" aria-hidden="true">
          {EDGE_FALLS.map((f, i) => (
            <div key={i} className="lp-edge-fall" style={{ left:`${f.x}%`, width:f.s, height:f.s, animationDuration:`${f.d}s`, animationDelay:`${f.dl}s` }} />
          ))}
        </div>
        {/* steps: full-width, no container */}
        <SectionReveal className="lp-steps-wrap">
          <motion.div className="lp-hiw-header lp-contain" variants={revealVariants}>
            <p className="lp-eyebrow lp-eyebrow-dim lp-text-center">HOW IT WORKS</p>
            <h2 className="lp-h2 lp-h2-light">
              Four steps to{' '}
              <em>get paid</em>
            </h2>
          </motion.div>
          <motion.div className="lp-steps" variants={containerVariants}>
            {STEPS.map((s, i) => (
              <motion.div key={s.num} className={`lp-step ${i % 2 === 1 ? 'lp-step-flip' : ''}`} variants={revealVariants}>
                <div className="lp-step-visual">
                  <StepVisual type={s.visual} />
                </div>
                <div className="lp-step-text">
                  <span className="lp-step-num" aria-hidden="true">{s.num}</span>
                  <h3 className="lp-step-title">{s.title}</h3>
                  <p className="lp-step-desc">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </SectionReveal>

        {/* pixel tear — chunky white + blue blocks like a buffer glitch */}
        <div className="lp-px-tear" aria-hidden="true">
          {TEAR_BLOCKS.map((b, i) => (
            <div key={i} className={`lp-px-tear-blk lp-px-tear-blk--${b.t}`} style={{ left:`${b.x}%`, top:`${b.y}%`, width:b.s, height:b.s }} />
          ))}
        </div>

        <SectionReveal className="lp-cmp-wrap">
          <div className="lp-cmp-falls" aria-hidden="true">
            {CMP_SIDE_FALLS.map((f, i) => (
              <div key={i} className="lp-cmp-fall" style={{ left:`${f.x}%`, width:f.s, height:f.s, animationDuration:`${f.d}s`, animationDelay:`${f.dl}s` }} />
            ))}
          </div>
          <div className="lp-contain">
            <motion.p variants={revealVariants} className="lp-eyebrow lp-eyebrow-dim lp-text-center">AUTOPAY VS TRADITIONAL</motion.p>
            <motion.h2 variants={revealVariants} className="lp-h2 lp-h2-light">
              Half the cost.{' '}
              <em>None of the risk.</em>
            </motion.h2>
            {/* Terminal diff comparison — split layout */}
            <motion.div className="lp-diff" variants={containerVariants}>
              <div className="lp-diff-chrome">
                <div className="lp-diff-dots">
                  <span className="lp-diff-dot lp-diff-dot--r" />
                  <span className="lp-diff-dot lp-diff-dot--y" />
                  <span className="lp-diff-dot lp-diff-dot--g" />
                </div>
                <span className="lp-diff-title">compare --autopay --traditional</span>
              </div>
              <div className="lp-diff-body lp-diff-body--split">
                {ROWS.map((r) => (
                  <motion.div key={r.label} variants={revealVariants} className="lp-diff-block">
                    <div className="lp-diff-comment"><span className="lp-diff-slashes">{'//'}</span> {r.label}</div>
                    <div className="lp-diff-add"><span className="lp-diff-sign">+</span> {r.us}</div>
                    <div className="lp-diff-del"><span className="lp-diff-sign">−</span> <span className="lp-diff-struck">{r.them}</span></div>
                  </motion.div>
                ))}
              </div>
              <div className="lp-diff-footer">
                <motion.div variants={revealVariants} className="lp-diff-result">
                  <span className="lp-diff-caret">{'>'}</span> autopay wins on <span className="lp-diff-count">8/8</span> criteria
                  <span className="lp-diff-cursor" />
                </motion.div>
              </div>
            </motion.div>
          </div>
        </SectionReveal>
      </section>

      {/* ── pixel dissolve exit: dark → light ── */}
      <div className="lp-dissolve lp-dissolve-exit" aria-hidden="true">
        <div className="lp-dissolve-exit-base" />
        {EXIT_BLOCKS.map((b, i) => (
          <div key={i} className={`lp-blk lp-blk-exit-${b.t}`} style={{ left:`${b.x}%`, top:`${b.y}%`, width:b.w, height:b.h }} />
        ))}
      </div>

      {/* ── CTA ── */}
      <section className="lp-section lp-cta">
        <SectionReveal className="lp-contain lp-cta-inner">
          {/* Ambient orb */}
          <div className="lp-cta-orb" aria-hidden="true" />
          <motion.div variants={revealVariants} className="lp-cta-rule" />
          <motion.h2 variants={revealVariants} className="lp-cta-h2">
            Own your<br />subscription revenue
          </motion.h2>
          <motion.p variants={revealVariants} className="lp-cta-sub">
            No platform risk. No bank account. Just USDC, directly to your wallet.
          </motion.p>
          <motion.div variants={revealVariants} className="lp-cta-actions">
            <MotionButton onClick={onOpenApp} className="lp-btn-primary lp-btn-lg">
              Launch App <ArrowUpRight size={18} strokeWidth={2.5} />
            </MotionButton>
            <MotionButton onClick={onDocs} className="lp-btn-ghost">
              <BookOpen size={16} /> Read the Docs
            </MotionButton>
          </motion.div>
        </SectionReveal>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-top">
            <div className="lp-footer-brand">
              <img src="/favicon-512.png" alt="" className="lp-footer-icon" />
              <div>
                <div className="lp-footer-name">AutoPay Protocol</div>
                <div className="lp-footer-tagline">Non-custodial crypto subscriptions</div>
              </div>
            </div>
            <div className="lp-footer-cols">
              <div className="lp-footer-col">
                <div className="lp-footer-col-title">Product</div>
                <button onClick={onOpenApp} className="lp-footer-link">Launch App</button>
                <button onClick={onDocs} className="lp-footer-link">Documentation</button>
              </div>
              <div className="lp-footer-col">
                <div className="lp-footer-col-title">Developers</div>
                <a href="https://github.com/apeoverflow/auto-pay-protocol" target="_blank" rel="noopener noreferrer" className="lp-footer-link"><Github size={13} /> GitHub</a>
                <a href="https://www.npmjs.com/package/@autopayprotocol/sdk" target="_blank" rel="noopener noreferrer" className="lp-footer-link"><Package size={13} /> npm SDK</a>
              </div>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span className="lp-footer-copy">&copy; {new Date().getFullYear()} AutoPay Protocol</span>
            <div className="lp-footer-bottom-links" />
          </div>
        </div>
      </footer>

      {/* ── STYLES ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');

        .lp-root {
          --bg: #F5F5F7;
          --fg: #111113;
          --muted: #7C7C82;
          --blue: #0052FF;
          --blue-hover: #0047E0;
          --dark: hsl(228 28% 7%);
          --green: #16A34A;
          --red: #DC2626;
          --sans: 'DM Sans', system-ui, -apple-system, sans-serif;
          --serif: 'Instrument Serif', Georgia, serif;
          --ease: cubic-bezier(0.16, 1, 0.3, 1);

          min-height: 100vh;
          background: var(--bg);
          color: var(--fg);
          font-family: var(--sans);
          overflow-x: clip;
          position: relative;
        }

        /* ── dot grid texture ── */
        .lp-dot-grid {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0.35;
          background-image: radial-gradient(circle, #C8C8CC 0.8px, transparent 0.8px);
          background-size: 24px 24px;
        }
        .lp-root > *:not(.lp-dot-grid) { position: relative; z-index: 1; }

        /* ── hero gradient orb ── */
        .lp-hero-orb {
          position: absolute;
          top: -100px;
          left: 50%;
          transform: translateX(-50%);
          width: 700px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(ellipse at center, rgba(0,82,255,0.08) 0%, rgba(120,80,220,0.04) 40%, transparent 70%);
          filter: blur(60px);
          pointer-events: none;
          z-index: 0;
          animation: orbPulse 6s ease-in-out infinite;
        }
        @keyframes orbPulse {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.7; }
          50% { transform: translateX(-50%) scale(1.08); opacity: 1; }
        }

        /* ── USDC coin stream (arc path) ── */
        .lp-usdc-stream {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }
        .lp-hero { position: relative; }
        .lp-hero > *:not(.lp-usdc-stream):not(.lp-hero-orb) { position: relative; z-index: 1; }

        .lp-coin {
          position: absolute;
          offset-path: path("M 700 560 C 680 480, 580 420, 590 340 C 600 260, 720 220, 690 140 C 660 60, 700 -20, 710 -80");
          offset-rotate: 0deg;
          animation: followArc var(--dur, 14s) var(--delay, 0s) linear infinite;
          will-change: offset-distance, opacity;
          transform: translateX(var(--spread, 0px));
        }
        /* branching paths — shared trunk, diverging tops */
        .lp-arc-0 {
          offset-path: path("M 700 560 C 680 480, 580 420, 590 340 C 600 260, 720 220, 690 140 C 670 70, 640 10, 610 -60");
        }
        .lp-arc-1 {
          offset-path: path("M 700 560 C 680 480, 580 420, 590 340 C 600 260, 720 220, 690 140 C 690 60, 720 -10, 750 -70");
        }
        .lp-arc-2 {
          offset-path: path("M 700 560 C 680 480, 580 420, 590 340 C 600 260, 720 220, 690 140 C 660 50, 680 -30, 680 -90");
        }


        .lp-coin-body {
          border-radius: 50%;
          animation: coinTumble ease-in-out infinite;
          position: relative;
          transform-style: preserve-3d;
          transform: perspective(60px) rotateX(35deg) rotateY(-25deg);
        }
        /* ── 3D coin rim — pushed behind the face in Z-space.
             Perspective naturally reveals it on the far edge as the coin tilts.
             No gradient hacks needed — pure 3D geometry. ── */
        .lp-coin-body::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 50%;
          background: #0d4a82;
          transform: translateZ(-3px);
          backface-visibility: hidden;
        }
        /* ── drop shadow — pushed even further back ── */
        .lp-coin-body::after {
          content: '';
          position: absolute;
          inset: 2px;
          border-radius: 50%;
          background: rgba(10,40,80,0.35);
          transform: translateZ(-6px);
          filter: blur(8px);
          backface-visibility: hidden;
        }
        /* ── coin face sits at the front in Z ── */
        .lp-coin-body img {
          display: block;
          border-radius: 50%;
          position: relative;
          transform: translateZ(0px);
          backface-visibility: hidden;
        }

        @keyframes followArc {
          0%   { offset-distance: 0%;   opacity: 0; transform: translateX(var(--spread, 0px)) scale(1); }
          5%   { offset-distance: 3%;   opacity: 1; transform: translateX(var(--spread, 0px)) scale(1); }
          20%  { offset-distance: 10%;  opacity: 1; transform: translateX(var(--spread, 0px)) scale(1); }
          40%  { offset-distance: 20%;  opacity: 1; transform: translateX(var(--spread, 0px)) scale(1); }
          55%  { offset-distance: 28%;  opacity: 1; transform: translateX(var(--spread, 0px)) scale(1); }
          70%  { offset-distance: 38%;  opacity: 1; transform: translateX(var(--spread, 0px)) scale(1); }
          80%  { offset-distance: 48%;  opacity: 1; transform: translateX(var(--spread, 0px)) scale(1); }
          87%  { offset-distance: 60%;  opacity: 1; transform: translateX(var(--spread, 0px)) scale(0.95); }
          92%  { offset-distance: 75%;  opacity: 0.8; transform: translateX(var(--spread, 0px)) scale(0.85); }
          95%  { offset-distance: 88%;  opacity: 0.5; transform: translateX(var(--spread, 0px)) scale(0.7); }
          97%  { offset-distance: 95%;  opacity: 0.25; transform: translateX(var(--spread, 0px)) scale(0.5); }
          100% { offset-distance: 100%; opacity: 0; transform: translateX(var(--spread, 0px)) scale(0.2); }
        }

        /* Coin tumbles through tilt angles. The ::before rim sits at
           translateZ(-4px) behind the face, so perspective naturally reveals
           it on the correct side — no manual edge tracking needed. */
        @keyframes coinTumble {
          0%   { transform: perspective(60px) rotateX(35deg)  rotateY(-25deg) rotate(-2deg); }
          15%  { transform: perspective(60px) rotateX(15deg)  rotateY(-45deg) rotate(1deg); }
          30%  { transform: perspective(60px) rotateX(-25deg) rotateY(-15deg) rotate(3deg); }
          45%  { transform: perspective(60px) rotateX(-40deg) rotateY(18deg)  rotate(0deg); }
          60%  { transform: perspective(60px) rotateX(-15deg) rotateY(42deg)  rotate(-2deg); }
          75%  { transform: perspective(60px) rotateX(20deg)  rotateY(30deg)  rotate(1deg); }
          90%  { transform: perspective(60px) rotateX(40deg)  rotateY(8deg)   rotate(-1deg); }
          100% { transform: perspective(60px) rotateX(35deg)  rotateY(-25deg) rotate(-2deg); }
        }

        /* ── aura mist system ── */
        .lp-mist {
          position: absolute;
          border-radius: 50%;
          filter: blur(65px);
          animation: mistBreathe 7s ease-in-out infinite;
          transform: translate(-50%, -50%);
          opacity: 0.5;
        }
        .lp-mist-2 {
          left: 585px; top: 340px;
          width: 240px; height: 240px;
          background: radial-gradient(circle, rgba(39,117,202,0.14), rgba(80,140,220,0.05) 50%, transparent 70%);
          animation-delay: -1.8s;
          animation-duration: 6.5s;
        }
        .lp-mist-3 {
          left: 700px; top: 220px;
          width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(39,117,202,0.10), rgba(100,160,230,0.04) 50%, transparent 70%);
          animation-delay: -3.5s;
          animation-duration: 7.5s;
        }
        .lp-mist-5 {
          left: 700px; top: 40px;
          width: 240px; height: 160px;
          background: radial-gradient(ellipse, rgba(39,117,202,0.16), rgba(100,160,230,0.06) 45%, transparent 65%);
          animation-delay: -2s;
          animation-duration: 5.5s;
        }

        @keyframes mistBreathe {
          0%, 100% { transform: translate(-50%, -50%) scale(0.95); opacity: 0.45; }
          50%      { transform: translate(-50%, -50%) scale(1.08); opacity: 0.7; }
        }

        .lp-tendril {
          position: absolute;
          border-radius: 50%;
          filter: blur(40px);
          opacity: 0;
          animation: tendrilDrift 8s ease-in-out infinite;
        }
        .lp-tendril-1 {
          left: 620px; top: 380px;
          width: 120px; height: 40px;
          background: rgba(39,117,202,0.14);
          animation-delay: -1s;
          animation-duration: 7s;
        }
        .lp-tendril-3 {
          left: 710px; top: 90px;
          width: 140px; height: 30px;
          background: rgba(39,117,202,0.16);
          animation-delay: -7s;
          animation-duration: 6s;
        }

        @keyframes tendrilDrift {
          0%   { opacity: 0; transform: translate(-30px, 0) scaleX(0.7) rotate(-8deg); }
          20%  { opacity: 0.8; }
          50%  { opacity: 1; transform: translate(30px, -10px) scaleX(1.3) rotate(4deg); }
          80%  { opacity: 0.6; }
          100% { opacity: 0; transform: translate(-20px, 5px) scaleX(0.8) rotate(-5deg); }
        }

        /* shimmer particles */
        .lp-shimmer {
          position: absolute;
          offset-rotate: auto;
          will-change: offset-distance, opacity;
        }
        .lp-shimmer-core {
          position: relative;
          border-radius: 50%;
        }

        .lp-shimmer-firefly {
          animation: shimmerFirefly 18s -7s linear infinite;
        }
        .lp-shimmer-firefly .lp-shimmer-core {
          width: 3px; height: 3px;
          background: rgba(160,200,255,0.8);
          box-shadow: 0 0 8px 3px rgba(39,117,202,0.5);
          animation: fireflyBlink 2s ease-in-out infinite;
        }
        .lp-shimmer-firefly .lp-shimmer-core::after {
          content: '';
          position: absolute;
          top: 50%; right: 100%;
          width: 8px; height: 1.5px;
          transform: translateY(-50%);
          border-radius: 1px;
          background: linear-gradient(to left, rgba(39,117,202,0.3), transparent);
        }
        /* First 50% is the actual travel (same speed as 9s),
           last 50% stays invisible — creates a gap between appearances */
        @keyframes shimmerFirefly {
          0%   { offset-distance: 0%;   opacity: 0; }
          3%   { offset-distance: 3%;   opacity: 0.45; }
          15%  { offset-distance: 14%;  opacity: 0.55; }
          28%  { offset-distance: 28%;  opacity: 0.55; }
          38%  { offset-distance: 42%;  opacity: 0.55; }
          44%  { offset-distance: 60%;  opacity: 0.45; }
          47%  { offset-distance: 82%;  opacity: 0.25; }
          49%  { offset-distance: 95%;  opacity: 0.1; }
          50%  { offset-distance: 100%; opacity: 0; }
          100% { offset-distance: 100%; opacity: 0; }
        }
        @keyframes fireflyBlink {
          0%, 100% { opacity: 1; transform: scale(1); }
          30%  { opacity: 0.1; transform: scale(0.5); }
          35%  { opacity: 1; transform: scale(1.3); }
          60%  { opacity: 0.8; transform: scale(0.9); }
          80%  { opacity: 0.15; transform: scale(0.4); }
          85%  { opacity: 1; transform: scale(1.1); }
        }

        .lp-shimmer-streak {
          animation: shimmerStreak 5s -1s linear infinite;
        }
        .lp-shimmer-streak .lp-shimmer-core {
          width: 10px; height: 2.5px;
          border-radius: 2px;
          background: linear-gradient(to right, transparent, rgba(39,117,202,0.7), rgba(180,210,255,0.9));
          box-shadow: 0 0 6px 1px rgba(39,117,202,0.4);
        }
        .lp-shimmer-streak .lp-shimmer-core::after {
          content: '';
          position: absolute;
          top: 50%; right: 100%;
          width: 50px; height: 1.5px;
          transform: translateY(-50%);
          border-radius: 1px;
          background: linear-gradient(to left, rgba(39,117,202,0.4), rgba(100,170,255,0.1), transparent);
          filter: blur(0.5px);
        }
        @keyframes shimmerStreak {
          0%   { offset-distance: 0%;   opacity: 0; }
          2%   { offset-distance: 3%;   opacity: 0.5; }
          13%  { offset-distance: 16%;  opacity: 0.65; }
          24%  { offset-distance: 30%;  opacity: 0.65; }
          33%  { offset-distance: 44%;  opacity: 0.65; }
          38%  { offset-distance: 62%;  opacity: 0.5; }
          41%  { offset-distance: 82%;  opacity: 0.3; }
          43%  { offset-distance: 95%;  opacity: 0.12; }
          45%  { offset-distance: 100%; opacity: 0; }
          100% { offset-distance: 100%; opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .lp-coin { animation: none; offset-distance: 50%; opacity: 0.5; }
          .lp-coin-body { animation: none; }
          .lp-mist { animation: none; }
          .lp-tendril { animation: none; opacity: 0.4; }
          .lp-shimmer { animation: none; offset-distance: 50%; opacity: 0.3; }
          .lp-shimmer-core::after { display: none; }
          .lp-hero-orb { animation: none; }
          .lp-cta-orb { animation: none; }
          .lp-pulse-ring { animation: none !important; }
          .lp-ticker-track { animation: none; }
          .lp-hero-card-1, .lp-hero-card-2, .lp-hero-card-3 { animation: none !important; }
          .lp-hc-badge-dot { animation: none; }
          .lp-hc-progress-fill::after { animation: none; display: none; }
          .lp-step { transition: none; }
          .lp-step-num { transition: none; }
          .lp-cmp-row { transition: none; }
        }

        @media (max-width: 959px) {
          .lp-usdc-stream { display: none; }
        }

        /* ── nav ── */
        .lp-nav {
          position: sticky; top: 0; z-index: 100;
          backdrop-filter: blur(20px) saturate(1.8);
          -webkit-backdrop-filter: blur(20px) saturate(1.8);
          background: rgba(245,245,247,0.7);
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .lp-nav-inner {
          max-width: 1040px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 28px;
        }
        .lp-nav-brand { display: flex; align-items: center; }
        .lp-nav-logo {
          height: 44px; width: auto;
          filter: brightness(0); opacity: 0.65;
          transition: opacity 0.2s;
        }
        .lp-nav-brand:hover .lp-nav-logo { opacity: 0.9; }
        .lp-nav-links { display: flex; align-items: center; gap: 24px; }
        .lp-nav-link {
          background: none; border: none; font-family: var(--sans);
          font-size: 13px; font-weight: 500; color: var(--muted);
          cursor: pointer; transition: color 0.2s;
        }
        .lp-nav-link:hover { color: var(--fg); }
        .lp-nav-cta {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 10px; border: none;
          background: var(--fg); color: #fff;
          font-family: var(--sans); font-size: 13px; font-weight: 600;
          cursor: pointer; transition: background 0.2s;
        }
        .lp-nav-cta:hover { background: #333; }
        @media (max-width: 639px) {
          .lp-nav-inner { padding: 12px 16px; }
          .lp-nav-logo { height: 28px; }
          .lp-nav-links { gap: 12px; }
          .lp-nav-link { font-size: 12px; }
          .lp-nav-cta { font-size: 12px; padding: 6px 12px; white-space: nowrap; }
        }

        /* ── hero ── */
        .lp-hero { padding: 80px 28px 0; max-width: 1160px; margin: 0 auto; }
        .lp-hero-inner {
          display: grid;
          grid-template-columns: 1fr;
          gap: 48px;
          align-items: center;
        }
        @media (min-width: 960px) {
          .lp-hero-inner { grid-template-columns: 1fr 1.15fr; gap: 56px; }
          .lp-hero-text { text-align: left; }
          .lp-hero-actions { justify-content: flex-start; }
        }
        .lp-hero-text { text-align: center; }

        .lp-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: 0.18em;
          color: var(--blue); margin-bottom: 20px;
        }
        .lp-text-center { text-align: center; }

        .lp-hero-h1 {
          font-size: clamp(36px, 5.5vw, 60px);
          font-weight: 700; line-height: 1.08;
          letter-spacing: -0.04em; margin: 0;
        }
        .lp-hero-h1 em, .lp-h2 em {
          font-family: var(--serif); font-style: italic;
          font-weight: 400; color: var(--blue);
        }
        .lp-hero-sub {
          margin-top: 20px; font-size: 16px; line-height: 1.65;
          color: var(--muted); max-width: 440px;
        }
        @media (max-width: 959px) { .lp-hero-sub { margin-left: auto; margin-right: auto; } }

        .lp-hero-actions {
          margin-top: 32px; display: flex; align-items: center;
          justify-content: center; gap: 8px; flex-wrap: wrap;
        }

        /* ── hero cards ── */
        .lp-hero-visual {
          perspective: 1200px;
          transform-style: preserve-3d;
        }

        .lp-hero-cards {
          position: relative;
          width: 420px;
          height: 340px;
          margin: 0 auto;
          transform-style: preserve-3d;
        }

        .lp-hero-card {
          position: absolute;
          width: 360px;
          background: #fff;
          border-radius: 16px;
          padding: 22px 26px;
          border: 1px solid rgba(0,0,0,0.05);
          transition: box-shadow 0.5s var(--ease);
        }

        .lp-hero-card-3 {
          z-index: 1;
          bottom: 56px; left: 54px;
          transform: scale(0.94);
          box-shadow:
            0 2px 6px rgba(0,0,0,0.03),
            0 8px 28px rgba(0,0,0,0.05);
          animation: heroFloat3 5.5s ease-in-out infinite;
          opacity: 0.92;
        }

        .lp-hero-card-2 {
          z-index: 2;
          bottom: 28px; left: 27px;
          transform: scale(0.97);
          box-shadow:
            0 2px 8px rgba(0,0,0,0.04),
            0 12px 40px rgba(0,0,0,0.07);
          animation: heroFloat2 7s ease-in-out infinite;
        }

        .lp-hero-card-1 {
          z-index: 3;
          bottom: 0; left: 0;
          box-shadow:
            0 1px 2px rgba(0,0,0,0.03),
            0 4px 16px rgba(0,0,0,0.06),
            0 16px 48px rgba(0,0,0,0.09),
            0 0 0 1px rgba(0,82,255,0.04);
          animation: heroFloat1 6s ease-in-out infinite;
          overflow: hidden;
        }

        @keyframes heroFloat1 {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes heroFloat2 {
          0%, 100% { transform: scale(0.96) translateY(0); }
          50% { transform: scale(0.96) translateY(4px); }
        }
        @keyframes heroFloat3 {
          0%, 100% { transform: scale(0.92) translateY(0); }
          50% { transform: scale(0.92) translateY(-3px); }
        }

        .lp-hc-accent-edge {
          position: absolute;
          top: 0; left: 0; bottom: 0;
          width: 4px;
          border-radius: 16px 0 0 16px;
          background: linear-gradient(to bottom, var(--blue), rgba(0,82,255,0.4));
        }

        .lp-hc-header {
          display: flex; align-items: center; gap: 9px; margin-bottom: 16px;
        }
        .lp-hc-name {
          font-size: 13.5px; font-weight: 620; color: var(--fg);
          letter-spacing: -0.005em;
        }

        .lp-hc-icon-wrap {
          width: 24px; height: 24px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .lp-hc-icon-green { background: var(--green); }
        .lp-hc-icon-neutral {
          background: rgba(0,0,0,0.05); color: var(--muted);
        }

        .lp-hc-robot-icon {
          width: 24px; height: 24px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        .lp-hc-badge {
          margin-left: auto;
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 640;
          padding: 4px 11px; border-radius: 20px;
          background: rgba(0,82,255,0.07); color: var(--blue);
          letter-spacing: 0.01em;
        }
        .lp-hc-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--blue);
          animation: badgePulse 2.5s ease-in-out infinite;
        }
        @keyframes badgePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }

        .lp-hc-amount-xl {
          font-size: 32px; font-weight: 750; letter-spacing: -0.035em;
          color: var(--fg); margin-bottom: 18px; line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .lp-hc-period {
          font-size: 14px; font-weight: 480; color: var(--muted);
          letter-spacing: 0;
        }
        .lp-hc-amount-lg {
          font-size: 26px; font-weight: 720; letter-spacing: -0.03em;
          color: var(--fg); margin-bottom: 14px; line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .lp-hc-amount-receipt { margin-bottom: 12px; }
        .lp-hc-unit {
          font-size: 13px; font-weight: 520; color: var(--muted);
          letter-spacing: 0.02em;
        }

        .lp-hc-progress-section { margin-bottom: 14px; }
        .lp-hc-progress-track {
          height: 5px; border-radius: 3px;
          background: rgba(0,0,0,0.05); overflow: hidden;
        }
        .lp-hc-progress-fill {
          height: 100%; border-radius: 3px;
          background: linear-gradient(90deg, var(--blue), #3b7cff);
          position: relative;
        }
        .lp-hc-progress-fill::after {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%);
          animation: progressShimmer 2.5s ease-in-out infinite;
        }
        @keyframes progressShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .lp-hc-progress-meta {
          display: flex; justify-content: space-between;
          font-size: 11px; font-weight: 520; color: var(--muted);
          margin-top: 7px; letter-spacing: 0.01em;
        }

        .lp-hc-divider {
          height: 1px; background: rgba(0,0,0,0.06);
          margin-bottom: 12px;
        }
        .lp-hc-footer-row {
          display: flex; justify-content: space-between; align-items: center;
        }
        .lp-hc-footer-label {
          font-size: 12px; font-weight: 500; color: var(--muted);
        }
        .lp-hc-footer-value {
          font-size: 13px; font-weight: 640; color: var(--fg);
          letter-spacing: -0.005em;
        }

        .lp-hc-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 6px 0;
          border-bottom: 1px solid rgba(0,0,0,0.04);
        }
        .lp-hc-label {
          font-size: 11px; font-weight: 560; color: var(--muted);
          text-transform: uppercase; letter-spacing: 0.06em;
        }
        .lp-hc-value {
          font-size: 13px; font-weight: 620; color: var(--fg);
        }
        .lp-hc-mono {
          font-family: 'SF Mono', Menlo, 'Cascadia Code', monospace;
          font-size: 12px; font-weight: 500;
          color: #555;
        }
        .lp-hc-timestamp {
          font-size: 11px; color: var(--muted); margin-top: 10px;
          padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.05);
          letter-spacing: 0.005em;
        }

        .lp-hc-chain-pill {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11.5px; font-weight: 600;
          padding: 3px 10px; border-radius: 6px;
          background: rgba(0,0,0,0.04); color: var(--muted);
        }
        .lp-hc-chain-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--green);
        }

        @media (max-width: 959px) {
          .lp-hero-card-2, .lp-hero-card-3 { display: none; }
          .lp-hero-cards {
            height: auto; width: 100%; max-width: 380px;
          }
          .lp-hero-card-1 {
            position: relative; width: 100%;
            animation: none;
          }
        }

        /* stats bar */
        .lp-stats-bar {
          margin-top: 64px; padding: 28px 0;
          display: flex; align-items: center; justify-content: center;
          gap: 0; flex-wrap: wrap;
          border-top: 1px solid rgba(0,0,0,0.07);
          border-bottom: 1px solid rgba(0,0,0,0.07);
        }
        .lp-stat {
          display: flex; flex-direction: column; align-items: center; padding: 0 40px;
        }
        .lp-stat-val {
          font-size: 32px; font-weight: 700; letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
        }
        .lp-stat-label {
          font-size: 12px; font-weight: 500; color: var(--muted);
          margin-top: 4px; letter-spacing: 0.01em;
        }
        .lp-stat-div { width: 1px; height: 40px; background: rgba(0,0,0,0.09); }

        /* ── buttons ── */
        .lp-btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 28px; border-radius: 12px; border: none;
          background: var(--blue); color: #fff;
          font-family: var(--sans); font-size: 15px; font-weight: 600;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 6px 24px rgba(0,82,255,0.16);
        }
        .lp-btn-lg { padding: 16px 32px; font-size: 16px; }
        .lp-btn-ghost {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 20px; border-radius: 12px; border: none;
          background: transparent; color: var(--muted);
          font-family: var(--sans); font-size: 15px; font-weight: 600;
          cursor: pointer;
        }

        /* ── sections ── */
        .lp-section { padding: 100px 28px; }
        .lp-section-tight-bottom { padding-bottom: 0; margin-bottom: 40px; }
        .lp-section-alt { background: rgba(0,0,0,0.015); }
        .lp-contain { max-width: 1040px; margin: 0 auto; }
        .lp-h2 {
          font-size: clamp(28px, 4.5vw, 44px);
          font-weight: 700; letter-spacing: -0.035em; line-height: 1.12;
          text-align: center; margin: 0 0 56px;
        }
        .lp-h2-light { color: #fff; }
        .lp-h2-light em { color: var(--blue); }

        /* ── story card (full-width deplatforming) ── */
        .lp-story-card {
          background: var(--dark);
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.06);
          overflow: hidden;
          margin-bottom: 16px;
          position: relative;
        }
        .lp-story-card::before {
          content: '';
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 200px 200px;
          opacity: 0.03;
          pointer-events: none; z-index: 1;
          border-radius: inherit;
        }
        .lp-story-card::after {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 10% 20%, hsl(221 83% 53% / 0.08), transparent),
            radial-gradient(ellipse 50% 60% at 85% 70%, hsl(260 60% 55% / 0.06), transparent);
          pointer-events: none; z-index: 1;
          border-radius: inherit;
        }
        .lp-story-inner {
          padding: 48px 40px;
          position: relative; z-index: 2;
        }
        .lp-story-icon {
          width: 40px; height: 40px; border-radius: 12px;
          background: var(--blue); color: #fff;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 28px;
          box-shadow: 0 4px 20px rgba(0,82,255,0.3);
        }
        .lp-story-quote {
          font-family: var(--serif);
          font-size: clamp(20px, 3vw, 28px);
          font-style: italic;
          font-weight: 400;
          line-height: 1.45;
          color: rgba(255,255,255,0.85);
          margin: 0 0 36px;
          max-width: 680px;
          letter-spacing: -0.01em;
        }
        .lp-story-stat-row {
          display: flex;
          align-items: center;
          gap: 0;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }
        .lp-story-stat {
          display: flex; flex-direction: column; align-items: center;
          padding: 0 32px;
        }
        .lp-story-stat-val {
          font-size: 28px; font-weight: 700; color: #fff;
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
        }
        .lp-story-stat-label {
          font-size: 11px; font-weight: 500; color: rgba(255,255,255,0.35);
          margin-top: 4px; letter-spacing: 0.01em;
        }
        .lp-story-stat-div {
          width: 1px; height: 36px; background: rgba(255,255,255,0.08);
        }
        .lp-story-foot {
          font-size: 14px; line-height: 1.65; color: rgba(255,255,255,0.55);
          margin: 0; max-width: 560px;
        }

        @media (max-width: 639px) {
          .lp-story-inner { padding: 28px 20px; }
          .lp-story-stat-row {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 0;
            justify-items: center;
          }
          .lp-story-stat-div { display: none; }
          .lp-story-stat { padding: 0 4px; }
          .lp-story-stat-val { font-size: 20px; }
          .lp-story-stat-label { font-size: 10px; text-align: center; }
          .lp-story-quote { font-size: 17px; }
        }

        /* ── case studies (two-column) ── */
        .lp-cases {
          display: grid; grid-template-columns: 1fr; gap: 20px;
          max-width: 100%; overflow: hidden;
        }
        @media (min-width: 768px) { .lp-cases { grid-template-columns: repeat(2, 1fr); } }

        .lp-case-card {
          position: relative;
          border-radius: 20px;
          padding: 2px;
          overflow: hidden;
          min-width: 0;
          transition: transform 0.35s cubic-bezier(0.22,1,0.36,1), box-shadow 0.35s cubic-bezier(0.22,1,0.36,1);
        }
        .lp-case-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04);
        }
        .lp-case-fee {
          background: linear-gradient(135deg, var(--blue) 0%, rgba(0,82,255,0.3) 50%, rgba(0,82,255,0.08) 100%);
        }
        .lp-case-deplat {
          background: linear-gradient(135deg, var(--red) 0%, rgba(239,68,68,0.3) 50%, rgba(239,68,68,0.08) 100%);
        }
        .lp-case-card-inner {
          background: #fff;
          border-radius: 18px;
          padding: 32px 28px;
          display: flex;
          flex-direction: column;
          height: 100%;
          position: relative;
          z-index: 1;
        }
        .lp-case-head {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 20px;
        }
        .lp-case-icon-wrap {
          width: 28px; height: 28px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
        }
        .lp-case-icon-wrap--blue {
          background: rgba(0,82,255,0.08); color: var(--blue);
        }
        .lp-case-icon-wrap--green {
          background: rgba(22,163,74,0.08); color: var(--green);
        }
        .lp-case-icon-wrap--red {
          background: rgba(220,38,38,0.08); color: var(--red);
        }
        .lp-case-tag {
          font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
          color: var(--blue); opacity: 0.7;
        }
        .lp-case-tag-geo { color: var(--green); }
        .lp-case-tag-red { color: var(--red); }
        .lp-case-title {
          font-size: 21px; font-weight: 660; letter-spacing: -0.025em;
          line-height: 1.35; margin: 0 0 28px; color: var(--fg);
        }
        .lp-case-title em {
          font-family: var(--serif); font-style: italic;
          font-weight: 400; color: var(--blue);
        }
        .lp-case-title-geo em { color: var(--fg); }
        .lp-case-em-red {
          font-family: var(--serif) !important; font-style: italic !important;
          font-weight: 400 !important; color: #DC2626 !important;
          text-decoration: underline;
          text-decoration-color: rgba(220,38,38,0.25);
          text-underline-offset: 3px;
          text-decoration-thickness: 2px;
        }
        .lp-case-note {
          font-size: 13px; line-height: 1.65; color: var(--muted); margin: 0;
          margin-top: auto; padding-top: 20px;
        }
        .lp-case-note strong { color: var(--blue); font-weight: 650; }
        .lp-case-note-geo strong { color: var(--green); }

        /* ── Interactive Fee Calculator ── */
        .lp-calc { display: flex; flex-direction: column; gap: 20px; }
        .lp-calc-controls { display: flex; flex-direction: column; gap: 12px; }
        .lp-calc-label {
          display: flex; justify-content: space-between; align-items: baseline;
        }
        .lp-calc-label-text {
          font-size: 12px; font-weight: 600; color: var(--muted);
          text-transform: uppercase; letter-spacing: 0.06em;
        }
        .lp-calc-label-val {
          font-size: 28px; font-weight: 780; color: var(--fg);
          letter-spacing: -0.03em; font-variant-numeric: tabular-nums;
          line-height: 1;
        }
        .lp-calc-slider-wrap {
          position: relative; height: 6px;
          background: rgba(0,0,0,0.06); border-radius: 3px;
          cursor: pointer;
        }
        .lp-calc-slider {
          position: absolute; inset: 0; width: 100%; height: 100%;
          opacity: 0; cursor: pointer; z-index: 2; margin: 0;
          -webkit-appearance: none; appearance: none;
        }
        .lp-calc-slider-fill {
          position: absolute; top: 0; left: 0; bottom: 0;
          background: var(--blue); border-radius: 3px;
          pointer-events: none;
          transition: width 0.08s ease-out;
        }
        .lp-calc-slider-fill::after {
          content: '';
          position: absolute; right: -7px; top: 50%; transform: translateY(-50%);
          width: 14px; height: 14px; border-radius: 50%;
          background: var(--blue);
          box-shadow: 0 0 0 3px rgba(0,82,255,0.2), 0 2px 8px rgba(0,82,255,0.3);
          transition: transform 0.15s;
        }
        .lp-calc-slider-wrap:hover .lp-calc-slider-fill::after {
          transform: translateY(-50%) scale(1.2);
        }
        .lp-calc-presets {
          display: flex; gap: 6px; flex-wrap: wrap;
        }
        .lp-calc-preset {
          padding: 4px 12px; border-radius: 20px;
          font-size: 11px; font-weight: 650;
          background: rgba(0,0,0,0.04); color: var(--muted);
          border: 1px solid transparent;
          cursor: pointer; transition: all 0.15s;
          letter-spacing: -0.01em;
        }
        .lp-calc-preset:hover {
          background: rgba(0,82,255,0.06); color: var(--blue);
          border-color: rgba(0,82,255,0.12);
        }
        .lp-calc-preset--active {
          background: rgba(0,82,255,0.10); color: var(--blue);
          border-color: rgba(0,82,255,0.2);
        }

        .lp-calc-race { display: flex; flex-direction: column; gap: 16px; }
        .lp-calc-race-label {
          font-size: 11px; font-weight: 600; color: var(--muted);
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .lp-calc-bar-group { display: flex; flex-direction: column; gap: 6px; }
        .lp-calc-bar-label {
          display: flex; justify-content: space-between; align-items: baseline;
          font-size: 13px; font-weight: 580; color: var(--fg);
        }
        .lp-calc-bar-amount {
          font-size: 15px; font-weight: 750; font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
        }
        .lp-calc-bar-amount--trad { color: var(--muted); }
        .lp-calc-bar-amount--auto { color: var(--blue); }
        .lp-calc-bar-track {
          position: relative; height: 28px;
          background: rgba(0,0,0,0.04); border-radius: 8px;
          overflow: hidden;
        }
        .lp-calc-bar-fill {
          position: absolute; top: 0; left: 0; bottom: 0;
          border-radius: 8px;
        }
        .lp-calc-bar-fill--trad {
          background: linear-gradient(90deg, rgba(124,124,130,0.15) 0%, rgba(124,124,130,0.25) 100%);
        }
        .lp-calc-bar-fill--auto {
          background: linear-gradient(90deg, rgba(0,82,255,0.15) 0%, rgba(0,82,255,0.3) 100%);
        }
        .lp-calc-bar-drain {
          position: absolute; top: 0; bottom: 0;
          background: repeating-linear-gradient(
            -45deg,
            transparent 0, transparent 4px,
            rgba(220,38,38,0.06) 4px, rgba(220,38,38,0.06) 8px
          );
        }
        .lp-calc-bar-fees {
          display: flex; gap: 6px; flex-wrap: wrap;
        }
        .lp-calc-fee-chip {
          font-size: 10px; font-weight: 600;
          color: var(--red); opacity: 0.7;
          background: rgba(220,38,38,0.06);
          padding: 2px 8px; border-radius: 10px;
        }
        .lp-calc-fee-chip--blue {
          color: var(--blue); opacity: 0.7;
          background: rgba(0,82,255,0.06);
        }

        .lp-calc-savings {
          text-align: center;
          padding: 20px 16px;
          background: linear-gradient(135deg, rgba(0,82,255,0.06) 0%, rgba(22,163,74,0.06) 100%);
          border: 1px solid rgba(0,82,255,0.10);
          border-radius: 14px;
          position: relative;
          overflow: hidden;
        }
        .lp-calc-savings::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 50% 0%, rgba(0,82,255,0.08) 0%, transparent 70%);
          pointer-events: none;
        }
        .lp-calc-savings-top {
          display: flex; align-items: baseline; justify-content: center; gap: 2px;
          position: relative; z-index: 1;
        }
        .lp-calc-savings-plus {
          font-size: 20px; font-weight: 700; color: var(--green);
        }
        .lp-calc-savings-amount {
          font-size: 36px; font-weight: 800; color: var(--blue);
          letter-spacing: -0.04em; font-variant-numeric: tabular-nums;
          line-height: 1;
        }
        .lp-calc-savings-per {
          font-size: 16px; font-weight: 600; color: var(--muted);
          margin-left: 2px;
        }
        .lp-calc-savings-yearly {
          font-size: 13px; color: var(--muted); margin-top: 6px;
          position: relative; z-index: 1;
        }
        .lp-calc-savings-yearly strong {
          color: var(--green); font-weight: 700;
        }

        /* ── Deplatforming Cases ── */
        .lp-deplat { display: flex; flex-direction: column; gap: 16px; }

        .lp-deplat-list {
          display: flex; flex-direction: column; gap: 8px;
        }
        .lp-deplat-row {
          padding: 12px 14px;
          background: rgba(220,38,38,0.03);
          border: 1px solid rgba(220,38,38,0.06);
          border-radius: 10px;
        }
        .lp-deplat-row-head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 4px;
        }
        .lp-deplat-entity {
          font-size: 13px; font-weight: 750; color: var(--fg);
        }
        .lp-deplat-year {
          font-size: 11px; font-weight: 600; color: var(--muted);
          font-variant-numeric: tabular-nums;
        }
        .lp-deplat-event {
          font-size: 12px; font-weight: 500; color: var(--fg);
          line-height: 1.45; opacity: 0.85;
        }
        .lp-deplat-source {
          font-size: 10px; font-weight: 500; color: var(--muted);
          margin-top: 4px; opacity: 0.5;
        }

        .lp-deplat-point {
          font-size: 13px; font-weight: 600; color: var(--fg);
          line-height: 1.45; text-align: center;
          padding: 0 8px;
        }

        .lp-deplat-fix {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px;
          background: linear-gradient(135deg, rgba(22,163,74,0.06) 0%, rgba(0,82,255,0.04) 100%);
          border: 1px solid rgba(22,163,74,0.12);
          border-radius: 12px;
        }
        .lp-deplat-fix-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: rgba(22,163,74,0.10); color: var(--green);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .lp-deplat-fix-text {
          display: flex; flex-direction: column; gap: 2px;
        }
        .lp-deplat-fix-title {
          font-size: 14px; font-weight: 700; color: var(--green);
        }
        .lp-deplat-fix-desc {
          font-size: 12px; font-weight: 500; color: var(--muted);
        }

        /* ── partners / integrations ticker ── */
        .lp-partners {
          padding: 56px 0 28px;
          position: relative;
          z-index: 2;
          overflow: hidden;
          mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
        }
        .lp-ticker-track {
          display: flex;
          width: max-content;
          animation: tickerScroll 35s linear infinite;
        }
        .lp-ticker-track:hover { animation-play-state: paused; }
        .lp-ticker-set {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .lp-partner-item {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          transition: opacity 0.2s;
          flex-shrink: 0;
        }
        .lp-partner-item:hover { opacity: 1; }
        .lp-partner-logo {
          height: 30px;
          width: 30px;
          object-fit: contain;
          opacity: 0.3;
          border-radius: 4px;
          filter: grayscale(0.8);
          transition: opacity 0.2s, filter 0.2s;
        }
        .lp-partner-name {
          font-size: 16px;
          font-weight: 620;
          color: var(--fg);
          letter-spacing: -0.01em;
          opacity: 0.25;
          transition: opacity 0.2s;
        }
        .lp-partner-item:hover .lp-partner-name { opacity: 0.7; }
        .lp-partner-item:hover .lp-partner-logo { opacity: 0.7; filter: grayscale(0.2); }
        .lp-partner-dot {
          width: 3px; height: 3px; border-radius: 50%;
          background: rgba(0,0,0,0.1);
          margin: 0 18px;
          flex-shrink: 0;
          opacity: 0.3;
        }
        @media (max-width: 639px) {
          .lp-partners { padding: 32px 0 24px; }
          .lp-ticker-track { animation-duration: 25s; }
          .lp-partner-dot { margin: 0 12px; }
          .lp-partner-name { font-size: 14px; }
          .lp-partner-logo { height: 24px; width: 24px; }
        }

        /* ── pixel dissolve transition ── */
        .lp-dissolve {
          position: relative;
          height: clamp(160px, 18vw, 280px);
          background: var(--bg);
          overflow: hidden;
          mask-image: linear-gradient(to bottom, transparent 0%, black 15%);
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%);
        }
        .lp-dissolve-base {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 50%;
          background: var(--dark);
        }
        .lp-dissolve::after {
          content: '';
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 200px 200px;
          opacity: 0.03;
          pointer-events: none; z-index: 10;
        }
        .lp-blk {
          position: absolute;
        }
        .lp-blk-dark {
          background: var(--dark);
        }
        .lp-blk-outline {
          background: transparent;
          border: 2px solid rgba(0,82,255,0.45);
        }
        .lp-blk-fill {
          background: rgba(0,82,255,0.12);
          border: 2px solid rgba(0,82,255,0.35);
        }
        /* falling blocks */
        .lp-blk-fall {
          position: absolute;
          top: -10%;
          background: var(--dark);
          border: 1.5px solid rgba(0,82,255,0.3);
          opacity: 0;
          animation: blkFall 3.5s ease-in infinite;
        }
        @keyframes blkFall {
          0% { top: -10%; opacity: 0; }
          10% { opacity: 0.6; }
          50% { opacity: 0.3; }
          100% { top: 105%; opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lp-blk-fall { animation: none; }
        }

        /* ── exit dissolve: dark → light (inverted) ── */
        .lp-dissolve-exit {
          background: var(--bg);
          height: clamp(140px, 18vw, 260px);
          mask-image: linear-gradient(to top, transparent 0%, black 15%);
          -webkit-mask-image: linear-gradient(to top, transparent 0%, black 15%);
        }
        .lp-dissolve-exit-base {
          position: absolute;
          left: 0; right: 0; top: 0;
          height: 50%;
          background: var(--dark);
        }
        .lp-blk-exit-dark { background: var(--dark); }
        .lp-blk-exit-outline {
          background: transparent;
          border: 2px solid rgba(0,82,255,0.45);
        }
        .lp-blk-exit-fill {
          background: rgba(0,82,255,0.12);
          border: 2px solid rgba(0,82,255,0.35);
        }

        /* ── unified dark section (HIW + comparison) ── */
        .lp-section-unified {
          padding-top: 0;
          padding-bottom: 96px;
        }
        .lp-hiw-header {
          text-align: center;
          margin-top: -40px;
          padding-bottom: 8px;
        }

        /* ── pixel tear: horizontal band of chunky blocks ── */
        .lp-px-tear {
          position: relative;
          height: clamp(120px, 16vw, 220px);
          margin: 140px 0 20px;
          z-index: 3;
          overflow: visible;
        }
        .lp-px-tear-blk {
          position: absolute;
        }
        .lp-px-tear-blk--light {
          background: var(--bg);
          background-image: radial-gradient(circle, rgba(0,0,0,0.06) 0.8px, transparent 0.8px);
          background-size: 12px 12px;
        }
        .lp-px-tear-blk--blue-fill {
          background: rgba(0,82,255,0.12);
          border: 2px solid rgba(0,82,255,0.4);
        }
        .lp-px-tear-blk--blue-outline {
          background: transparent;
          border: 2px solid rgba(0,82,255,0.35);
        }

        /* ── edge falls: blue squares cascading down both sides ── */
        .lp-edge-falls {
          position: absolute;
          top: -450px;
          left: 0;
          right: 0;
          height: 1400px;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        .lp-edge-fall {
          position: absolute;
          top: -10%;
          background: rgba(0,82,255,0.06);
          border: 1.5px solid rgba(0,82,255,0.4);
          opacity: 0;
          animation: edgeFall 8s ease-in infinite;
        }
        @keyframes edgeFall {
          0% { top: -8%; opacity: 0; }
          5% { opacity: 0.55; }
          35% { opacity: 0.3; }
          100% { top: 100%; opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lp-edge-fall { animation: none; }
        }

        /* ── comparison wrapper inside unified dark section ── */
        .lp-cmp-wrap {
          padding-top: 80px;
          position: relative;
          overflow: hidden;
        }
        .lp-cmp-falls {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .lp-cmp-fall {
          position: absolute;
          top: -10%;
          background: rgba(0,82,255,0.06);
          border: 1.5px solid rgba(0,82,255,0.5);
          opacity: 0;
          animation: blkFall 4s ease-in infinite;
        }
        .lp-cmp-wrap > *:not(.lp-cmp-falls) {
          position: relative;
          z-index: 1;
        }
        @media (prefers-reduced-motion: reduce) {
          .lp-cmp-fall { animation: none; }
        }

        /* ── steps: full-width editorial ── */
        .lp-steps-wrap {
          margin-top: 48px;
        }
        .lp-steps {
          display: flex;
          flex-direction: column;
          gap: 0;
          width: 100%;
        }
        .lp-step {
          display: grid;
          grid-template-columns: 1fr 1fr;
          align-items: center;
          min-height: 320px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .lp-step:last-child {
          border-bottom: none;
        }
        /* flip even rows */
        .lp-step-flip .lp-step-visual { order: 2; }
        .lp-step-flip .lp-step-text { order: 1; }

        .lp-step-visual {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 48px 40px 48px 56px;
        }
        .lp-step-flip .lp-step-visual {
          justify-content: flex-start;
          padding: 48px 56px 48px 40px;
        }
        /* subtle glow behind vignettes */
        .lp-step-visual::before {
          content: '';
          position: absolute;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0,82,255,0.06) 0%, transparent 70%);
          pointer-events: none;
          filter: blur(40px);
        }
        .lp-step-visual { position: relative; }

        .lp-step-text {
          padding: 56px 64px;
          border-left: 1px solid rgba(0,82,255,0.08);
          position: relative;
        }
        .lp-step-flip .lp-step-text {
          border-left: none;
          border-right: 1px solid rgba(0,82,255,0.08);
        }
        .lp-step-num {
          display: block;
          font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
          font-size: 72px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.04em;
          background: linear-gradient(180deg, rgba(0,82,255,0.35) 0%, rgba(0,82,255,0.12) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          user-select: none;
          margin-bottom: 12px;
        }
        .lp-step-title {
          font-size: 28px;
          font-weight: 720;
          letter-spacing: -0.03em;
          margin: 0 0 12px;
          color: #fff;
        }
        .lp-step-desc {
          font-size: 15px;
          line-height: 1.7;
          color: rgba(255,255,255,0.45);
          margin: 0;
          max-width: 400px;
        }

        /* ── step vignettes (shared) ── */
        .lp-sv {
          width: 100%;
          max-width: 420px;
          font-size: 12px;
          line-height: 1.5;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 16px 18px;
        }

        /* dashboard vignette */
        .lp-sv-dash-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .lp-sv-dash-row:last-of-type { border-bottom: none; }
        .lp-sv-dash-label {
          color: rgba(255,255,255,0.35);
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 550;
        }
        .lp-sv-dash-val {
          font-weight: 600;
          color: rgba(255,255,255,0.85);
          font-size: 12px;
        }
        .lp-sv-dash-price small {
          color: rgba(255,255,255,0.4);
          font-weight: 500;
          font-size: 10px;
        }
        .lp-sv-dash-btn {
          margin-top: 10px;
          padding: 6px 0;
          text-align: center;
          font-size: 10.5px;
          font-weight: 650;
          letter-spacing: 0.02em;
          color: #fff;
          background: var(--blue);
          border-radius: 6px;
        }

        /* link vignette */
        .lp-sv-link-bar {
          display: flex;
          align-items: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 6px 8px;
          gap: 6px;
        }
        .lp-sv-link-url {
          flex: 1;
          font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
          font-size: 9.5px;
          color: rgba(255,255,255,0.7);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .lp-sv-link-copy {
          flex-shrink: 0;
          font-size: 9.5px;
          font-weight: 650;
          color: var(--blue);
          padding: 2px 8px;
          background: rgba(0,82,255,0.15);
          border-radius: 4px;
          cursor: default;
        }
        .lp-sv-link-or {
          text-align: center;
          font-size: 9.5px;
          color: rgba(255,255,255,0.3);
          margin: 8px 0 6px;
          font-weight: 500;
        }
        .lp-sv-link-code {
          font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
          font-size: 9.5px;
          color: var(--blue);
          background: rgba(0,82,255,0.08);
          border: 1px solid rgba(0,82,255,0.15);
          border-radius: 6px;
          padding: 6px 10px;
          text-align: center;
        }

        /* wallet vignette */
        .lp-sv-wallet-top {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
        }
        .lp-sv-wallet-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #22c55e;
        }
        .lp-sv-wallet-addr {
          font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
          font-size: 10px;
          color: rgba(255,255,255,0.7);
          font-weight: 500;
        }
        .lp-sv-wallet-badge {
          font-size: 9px;
          font-weight: 650;
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          padding: 1px 6px;
          border-radius: 4px;
          margin-left: auto;
        }
        .lp-sv-wallet-amount {
          font-size: 20px;
          font-weight: 750;
          color: #f0f2f5;
          letter-spacing: -0.03em;
          margin-bottom: 8px;
        }
        .lp-sv-wallet-amount small {
          font-size: 11px;
          font-weight: 500;
          color: rgba(255,255,255,0.4);
        }
        .lp-sv-wallet-chains {
          display: flex;
          gap: 4px;
        }
        .lp-sv-wallet-chains span {
          font-size: 9px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 4px;
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.5);
        }
        .lp-sv-wallet-chains span:last-child {
          color: var(--blue);
          background: rgba(0,82,255,0.15);
        }
        .lp-sv-wallet-btn {
          margin-top: 12px;
          padding: 6px 0;
          text-align: center;
          font-size: 10.5px;
          font-weight: 650;
          letter-spacing: 0.02em;
          color: #fff;
          background: var(--blue);
          border-radius: 6px;
        }

        /* webhook vignette */
        .lp-sv-hook-pre {
          font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
          font-size: 13px;
          line-height: 1.7;
          background: rgba(0,0,0,0.5);
          color: #a8b4c4;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.08);
          padding: 16px 20px;
          margin: 0;
          overflow: hidden;
          white-space: pre;
        }
        .lp-syn-method { color: #c678dd; font-weight: 700; }
        .lp-syn-url { color: #e5c07b; }
        .lp-syn-brace { color: rgba(255,255,255,0.5); }
        .lp-syn-key { color: #61afef; }
        .lp-syn-colon { color: rgba(255,255,255,0.35); }
        .lp-syn-str { color: #98c379; }
        .lp-syn-comma { color: rgba(255,255,255,0.3); }

        /* ── dark section ── */
        .lp-section-dark {
          background: var(--dark); color: #fff;
          position: relative; overflow: hidden;
          margin-top: -120px;
          padding-top: 120px;
        }

        /* aurora orbs */
        .lp-dark-aurora {
          position: absolute; inset: 0; z-index: 0;
          pointer-events: none; overflow: hidden;
        }
        .lp-dark-orb {
          position: absolute; border-radius: 50%;
          filter: blur(100px); will-change: transform;
        }
        .lp-dark-orb--1 {
          width: 500px; height: 500px;
          top: 5%; left: -8%;
          background: radial-gradient(circle, hsl(221 83% 53% / 0.12), transparent 70%);
          animation: lp-drift-1 14s ease-in-out infinite alternate;
        }
        .lp-dark-orb--2 {
          width: 400px; height: 400px;
          top: 40%; right: -5%;
          background: radial-gradient(circle, hsl(260 60% 55% / 0.08), transparent 70%);
          animation: lp-drift-2 16s ease-in-out infinite alternate;
        }
        .lp-dark-orb--3 {
          width: 350px; height: 350px;
          bottom: 10%; left: 25%;
          background: radial-gradient(circle, hsl(142 70% 45% / 0.06), transparent 70%);
          animation: lp-drift-3 12s ease-in-out infinite alternate;
        }
        @keyframes lp-drift-1 { from { transform: translate(0, 0); } to { transform: translate(40px, 30px); } }
        @keyframes lp-drift-2 { from { transform: translate(0, 0); } to { transform: translate(-30px, -20px); } }
        @keyframes lp-drift-3 { from { transform: translate(0, 0); } to { transform: translate(20px, -25px); } }

        /* grain texture */
        .lp-dark-grain {
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 200px 200px;
          opacity: 0.03;
          pointer-events: none;
        }

        .lp-section-dark > *:not(.lp-dark-aurora):not(.lp-edge-falls) { position: relative; z-index: 1; }

        .lp-eyebrow-dim { color: rgba(255,255,255,0.35); }
        .lp-cmp-block { padding-top: 0; }

        /* ── comparison: terminal diff ── */
        .lp-diff {
          max-width: 900px;
          margin: 0 auto;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,0.08);
          background: #f0eee9;
          font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
          position: relative;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.06);
        }
        .lp-diff::before {
          content: '';
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 200px 200px;
          opacity: 0.03;
          pointer-events: none; z-index: 0;
          border-radius: inherit;
        }
        .lp-diff > * { position: relative; z-index: 1; }

        .lp-diff-chrome {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 18px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          background: rgba(0,0,0,0.03);
        }
        .lp-diff-dots {
          display: flex; gap: 6px;
        }
        .lp-diff-dot {
          width: 10px; height: 10px; border-radius: 50%;
        }
        .lp-diff-dot--r { background: #ff5f57; }
        .lp-diff-dot--y { background: #febc2e; }
        .lp-diff-dot--g { background: #28c840; }
        .lp-diff-title {
          font-size: 11px;
          color: rgba(0,0,0,0.35);
          letter-spacing: 0.02em;
        }

        .lp-diff-body {
          padding: 20px 24px;
        }
        .lp-diff-body--split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px 32px;
        }
        .lp-diff-footer {
          padding: 12px 24px 16px;
          border-top: 1px solid rgba(0,0,0,0.06);
        }
        .lp-diff-block {
          margin-bottom: 6px;
        }
        .lp-diff-comment {
          font-size: 12px;
          line-height: 2;
          color: rgba(0,0,0,0.28);
        }
        .lp-diff-slashes {
          color: rgba(0,0,0,0.18);
        }
        .lp-diff-add {
          font-size: 13.5px;
          line-height: 2;
          color: #15803d;
          font-weight: 500;
          padding-left: 4px;
          border-radius: 3px;
          background: rgba(22,163,74,0.08);
        }
        .lp-diff-del {
          font-size: 12.5px;
          line-height: 2;
          color: rgba(185,28,28,0.5);
          font-weight: 400;
          padding-left: 4px;
          border-radius: 3px;
          background: rgba(220,38,38,0.04);
        }
        .lp-diff-sign {
          display: inline-block;
          width: 16px;
          font-weight: 700;
        }
        .lp-diff-struck {
          text-decoration: line-through;
          text-decoration-color: rgba(185,28,28,0.3);
        }

        .lp-diff-result {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(0,0,0,0.06);
          font-size: 13px;
          line-height: 2;
          color: rgba(0,0,0,0.45);
        }
        .lp-diff-caret {
          color: var(--blue);
          font-weight: 700;
          margin-right: 6px;
        }
        .lp-diff-count {
          color: #15803d;
          font-weight: 700;
        }
        .lp-diff-cursor {
          display: inline-block;
          width: 8px;
          height: 15px;
          background: var(--blue);
          margin-left: 4px;
          vertical-align: text-bottom;
          animation: lp-blink 1s step-end infinite;
        }
        @keyframes lp-blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        /* ── tablet ── */
        @media (max-width: 768px) {
          .lp-diff { max-width: 100%; }
          .lp-diff-body { padding: 16px 18px; }
          .lp-diff-body--split { grid-template-columns: 1fr; gap: 0; }
          .lp-diff-add { font-size: 13px; }
          .lp-diff-del { font-size: 12px; }
          .lp-step { min-height: 260px; }
          .lp-step-visual { padding: 36px 32px; }
          .lp-step-text { padding: 40px 36px; }
          .lp-step-num { font-size: 48px; }
          .lp-step-title { font-size: 22px; }
          .lp-step-desc { font-size: 13.5px; }
        }

        /* ── cta ── */
        .lp-cta { padding: 120px 28px; text-align: center; }
        .lp-cta-inner { display: flex; flex-direction: column; align-items: center; position: relative; }

        .lp-cta-orb {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 500px;
          height: 300px;
          border-radius: 50%;
          background: radial-gradient(ellipse at center, rgba(0,82,255,0.06) 0%, transparent 70%);
          filter: blur(50px);
          pointer-events: none;
          animation: orbPulse 6s ease-in-out infinite;
        }

        .lp-cta-rule {
          width: 48px; height: 3px; border-radius: 2px;
          background: var(--blue); margin-bottom: 40px;
          box-shadow: 0 0 12px rgba(0,82,255,0.3);
        }
        .lp-cta-h2 {
          font-size: clamp(28px, 4.5vw, 44px);
          font-weight: 700; letter-spacing: -0.035em; line-height: 1.12;
          margin: 0 0 12px;
        }
        .lp-cta-sub { font-size: 16px; color: var(--muted); margin: 0 0 32px; }
        .lp-cta-actions {
          display: flex; align-items: center; gap: 8px;
          flex-wrap: wrap; justify-content: center;
        }

        /* ── footer ── */
        .lp-footer {
          border-top: 1px solid rgba(0,0,0,0.06);
          padding: 48px 28px 32px;
          background: #fafafa;
        }
        .lp-footer-inner { max-width: 1160px; margin: 0 auto; }
        .lp-footer-top {
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 48px; padding-bottom: 32px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .lp-footer-brand { display: flex; align-items: center; gap: 12px; }
        .lp-footer-icon { height: 36px; width: 36px; border-radius: 8px; }
        .lp-footer-name {
          font-family: var(--sans); font-size: 15px; font-weight: 600;
          color: var(--fg); letter-spacing: -0.01em;
        }
        .lp-footer-tagline { font-size: 13px; color: var(--muted); margin-top: 1px; }
        .lp-footer-cols { display: flex; gap: 64px; }
        .lp-footer-col { display: flex; flex-direction: column; gap: 8px; }
        .lp-footer-col-title {
          font-family: var(--sans); font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.08em;
          color: var(--fg); margin-bottom: 4px;
        }
        .lp-footer-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--sans); font-size: 13px; font-weight: 450;
          color: var(--muted); text-decoration: none;
          border: none; background: none; cursor: pointer;
          padding: 0; transition: color 0.2s;
        }
        .lp-footer-link:hover { color: var(--fg); }
        .lp-footer-bottom {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: 20px;
        }
        .lp-footer-copy { font-size: 12px; color: var(--muted); }
        .lp-footer-bottom-links { display: flex; gap: 12px; }
        .lp-footer-social {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 8px;
          color: var(--muted); transition: color 0.2s, background 0.2s;
        }
        .lp-footer-social:hover { color: var(--fg); background: rgba(0,0,0,0.04); }

        /* ── mobile ── */
        @media (max-width: 639px) {
          .lp-hero { padding: 48px 20px 0; }
          .lp-stats-bar { margin-top: 40px; }
          .lp-stat { padding: 0 20px; }
          .lp-stat-val { font-size: 24px; }
          .lp-section { padding: 56px 16px; }
          .lp-h2 { font-size: 28px; }
          .lp-case-card-inner { padding: 24px 18px; }
          .lp-case-title { font-size: 17px; }
          .lp-calc-label-val { font-size: 22px; }
          .lp-calc-savings-amount { font-size: 28px; }
          .lp-calc-bar-track { height: 22px; }
          .lp-deplat-row { padding: 10px 12px; }
          .lp-deplat-event { font-size: 11px; }
          .lp-deplat-point { font-size: 12px; }
          /* steps: stack on mobile */
          .lp-step {
            grid-template-columns: 1fr;
            min-height: auto;
          }
          .lp-step-flip .lp-step-visual { order: 0; }
          .lp-step-flip .lp-step-text { order: 0; }
          .lp-step-visual { padding: 28px 20px 16px; }
          .lp-step-text { padding: 0 20px 36px; }
          .lp-step-num { font-size: 40px; margin-bottom: 8px; }
          .lp-step-title { font-size: 20px; }
          .lp-step-desc { font-size: 13px; max-width: none; }
          .lp-section-unified { padding: 32px 0 16px; }
          .lp-story-foot { display: none; }
          .lp-cmp-wrap { padding-top: 48px; }
          .lp-dissolve,
          .lp-dissolve-exit { height: 200px; margin-bottom: -40px; }
          .lp-dissolve .lp-blk:nth-child(odd) { display: none; }
          .lp-dissolve-exit .lp-blk:nth-child(3n) { display: none; }
          .lp-blk-fall:nth-child(odd) { display: none; }

          /* comparison: terminal diff on mobile */
          .lp-diff {
            border-radius: 8px;
            margin: 0 16px;
            max-width: calc(100vw - 32px);
            box-sizing: border-box;
          }
          .lp-diff-body { padding: 14px 14px; overflow-x: auto; }
          .lp-diff-body--split { grid-template-columns: 1fr; gap: 0; }
          .lp-diff-footer { padding: 10px 14px 14px; }
          .lp-diff-chrome { padding: 10px 14px; }
          .lp-diff-title { font-size: 10px; }
          .lp-diff-comment { font-size: 11px; }
          .lp-diff-add { font-size: 12px; }
          .lp-diff-del { font-size: 11px; }
          .lp-diff-result { font-size: 11.5px; }

          .lp-cta { padding: 64px 20px; }
          .lp-cta-inner h2 { font-size: 28px; }
          .lp-geo-grid { gap: 6px; }
          .lp-geo-item { padding: 8px 10px; }
          .lp-geo-city { font-size: 12px; }
          .lp-geo-status-pill { font-size: 8.5px; padding: 2px 6px; }

          .lp-footer { padding: 32px 20px 24px; }
          .lp-footer-top { flex-direction: column; gap: 32px; }
          .lp-footer-cols { gap: 40px; }
        }
      `}</style>
    </div>
  )
}
