import { useRef } from 'react'
import {
  ShieldCheck,
  Globe,
  BadgePercent,
  ArrowRight,
  BookOpen,
  ArrowUpRight,
  Check,
  X,
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  Github,
  Package,
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

const lineVariants: Variants = {
  hidden: { scaleX: 0 },
  visible: {
    scaleX: 1,
    transition: { type: 'spring', damping: 16, stiffness: 100, delay: 0.3 },
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
  { size: 30, dur: 14, spread: -8, wobble: 28, path: 0, edge: 145, tiltX: 22, tiltY: -16 },
  { size: 26, dur: 22, spread: 10, wobble: 32, path: 1, edge: 200, tiltX: -18, tiltY: -20 },
  { size: 34, dur: 10, spread: -4, wobble: 30, path: 2, edge: 170, tiltX: 16, tiltY: -12 },
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
              ['--edge' as string]: `${c.edge}deg`,
              ['--tiltX' as string]: `${c.tiltX}deg`,
              ['--tiltY' as string]: `${c.tiltY}deg`,
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
  const rotateX = useSpring(useTransform(y, [0, 1], [4, -4]), springCfg)
  const rotateY = useSpring(useTransform(x, [0, 1], [-4, 4]), springCfg)

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
      whileHover={prefersReduced ? {} : { y: -4, boxShadow: '0 12px 48px rgba(0,0,0,0.10)' }}
      transition={{ type: 'spring', damping: 14, stiffness: 160 }}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
    >
      {children}
    </motion.div>
  )
}

/* ── Fee Waterfall visual ── */
const WATERFALL_STEPS = [
  { label: 'Subscriber pays', amount: '$10.00', pct: 100, color: 'var(--muted)' },
  { label: 'Patreon takes 8% (Pro plan)', amount: '−$0.80', pct: 92, color: '#DC2626' },
  { label: 'Stripe takes 2.9% + 30¢', amount: '−$0.59', pct: 86.1, color: '#DC2626' },
  { label: 'Creator keeps', amount: '$8.61', pct: 86.1, color: 'var(--muted)' },
]

function FeeWaterfall() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.3 })
  const prefersReduced = useReducedMotion()
  return (
    <div ref={ref} className="lp-waterfall" aria-hidden="true">
      {WATERFALL_STEPS.map((step, i) => {
        const isLast = i === WATERFALL_STEPS.length - 1
        const isCut = step.amount.startsWith('−')
        return (
          <motion.div
            key={step.label}
            className={`lp-wf-row ${isLast ? 'lp-wf-row-result' : ''}`}
            initial={prefersReduced ? {} : { opacity: 0, x: -16 }}
            animate={inView || prefersReduced ? { opacity: 1, x: 0 } : {}}
            transition={{ type: 'spring', damping: 14, stiffness: 140, delay: i * 0.12 }}
          >
            <span className="lp-wf-label">{step.label}</span>
            <span className={`lp-wf-amount ${isCut ? 'lp-wf-cut' : ''} ${isLast ? 'lp-wf-final' : ''}`}>
              {step.amount}
            </span>
            {!isLast && (
              <motion.div
                className="lp-wf-bar"
                initial={{ scaleX: 0 }}
                animate={inView || prefersReduced ? { scaleX: step.pct / 100 } : { scaleX: 0 }}
                transition={{ type: 'spring', damping: 16, stiffness: 100, delay: i * 0.12 + 0.1 }}
                style={{ transformOrigin: 'left', background: isCut ? 'rgba(220,38,38,0.12)' : 'rgba(0,0,0,0.05)' }}
              />
            )}
          </motion.div>
        )
      })}
      {/* AutoPay alternative */}
      <motion.div
        className="lp-wf-alt"
        initial={prefersReduced ? {} : { opacity: 0, y: 12 }}
        animate={inView || prefersReduced ? { opacity: 1, y: 0 } : {}}
        transition={{ type: 'spring', damping: 14, stiffness: 140, delay: 0.6 }}
      >
        <span className="lp-wf-alt-label">With AutoPay (2.5% flat)</span>
        <span className="lp-wf-alt-amount">$9.75</span>
      </motion.div>
    </div>
  )
}

/* ── Timeline node for How It Works ── */
function TimelineNode({
  num,
  title,
  desc,
}: {
  num: string
  title: string
  desc: string
}) {
  const prefersReduced = useReducedMotion()
  return (
    <motion.div
      className="lp-timeline-node"
      variants={revealVariants}
    >
      <motion.div
        className="lp-timeline-circle"
        whileHover={prefersReduced ? {} : { scale: 1.15, boxShadow: '0 0 0 8px rgba(0,82,255,0.08), 0 0 20px rgba(0,82,255,0.15)' }}
        transition={{ type: 'spring', damping: 12, stiffness: 200 }}
      >
        {num}
      </motion.div>
      <h3 className="lp-timeline-title">{title}</h3>
      <p className="lp-timeline-desc">{desc}</p>
    </motion.div>
  )
}

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

const STEPS = [
  { num: '01', title: 'Add the Button', desc: 'Drop a checkout button or link on your site. Two lines of code — no backend required.' },
  { num: '02', title: 'Subscribers Pay', desc: 'Users connect any wallet and pay with USDC from 30+ chains. First charge is immediate.' },
  { num: '03', title: 'You Get Paid', desc: 'USDC lands directly in your wallet on schedule. No holds, no intermediaries, no delays.' },
]

/* ══════════════════════════════════════════════════════ */

export function LandingPage({ onOpenApp, onDocs }: LandingPageProps) {
  const prefersReduced = useReducedMotion()
  const timelineRef = useRef(null)
  const timelineInView = useInView(timelineRef, { once: true, amount: 0.3 })

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
      <section className="lp-section">
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

          {/* ── Two-column case studies ── */}
          <motion.div className="lp-cases" variants={containerVariants}>
            {/* Left: Fee waterfall */}
            <TiltCard className="lp-case-card">
              <div className="lp-case-head">
                <BadgePercent size={16} strokeWidth={2.5} className="lp-case-icon" />
                <span className="lp-case-tag">CASE STUDY</span>
              </div>
              <h3 className="lp-case-title">
                1,000 subscribers on Patreon?<br />
                You're leaving <em>$13,680/yr</em> on the table.
              </h3>
              <FeeWaterfall />
              <p className="lp-case-note">
                At 1,000 subs × $10/mo, Patreon Pro + Stripe keeps $8.61 per subscriber.
                AutoPay keeps $9.75. That's <strong>$1,140/mo more</strong> — or
                $13,680 per year back in your pocket.
              </p>
            </TiltCard>

            {/* Right: Geography exclusion */}
            <TiltCard className="lp-case-card">
              <div className="lp-case-head">
                <Globe size={16} strokeWidth={2.5} className="lp-case-icon" />
                <span className="lp-case-tag">CASE STUDY</span>
              </div>
              <h3 className="lp-case-title">
                Creators in Lagos, Bogotá, and Dhaka<br />
                <em>can't even access</em> Stripe.
              </h3>
              <div className="lp-geo-grid" aria-hidden="true">
                {[
                  { city: 'Lagos', flag: '🇳🇬', status: 'Restricted' },
                  { city: 'Bogotá', flag: '🇨🇴', status: 'Restricted' },
                  { city: 'Dhaka', flag: '🇧🇩', status: 'Unavailable' },
                  { city: 'Nairobi', flag: '🇰🇪', status: 'Limited' },
                ].map((c) => (
                  <div key={c.city} className="lp-geo-item">
                    <span className="lp-geo-flag">{c.flag}</span>
                    <span className="lp-geo-city">{c.city}</span>
                    <span className="lp-geo-status">{c.status}</span>
                  </div>
                ))}
              </div>
              <div className="lp-geo-vs">
                <div className="lp-geo-vs-row lp-geo-vs-bad">
                  <X size={14} strokeWidth={2.5} />
                  <span>Stripe: Bank account required, geography-gated, 4–7% fees</span>
                </div>
                <div className="lp-geo-vs-row lp-geo-vs-good">
                  <Check size={14} strokeWidth={3} />
                  <span>AutoPay: Any wallet, any country, 2.5% flat</span>
                </div>
              </div>
              <div className="lp-geo-stat-callout">
                <span className="lp-geo-stat-num">195+</span>
                <span className="lp-geo-stat-text">countries with crypto wallet access — vs 46 with full Stripe support</span>
              </div>
              <p className="lp-case-note">
                If you have a crypto wallet, you can accept subscriptions.
                No bank account, no KYC delays, no geography gates.
                Creators in emerging markets keep the same 2.5% rate as everyone else.
              </p>
            </TiltCard>
          </motion.div>
        </SectionReveal>
      </section>

      {/* ── HOW IT WORKS — connected timeline ── */}
      <section className="lp-section lp-section-alt">
        <SectionReveal className="lp-contain">
          <motion.p variants={revealVariants} className="lp-eyebrow lp-text-center">HOW IT WORKS</motion.p>
          <motion.h2 variants={revealVariants} className="lp-h2">
            Three steps to{' '}
            <em>get paid</em>
          </motion.h2>
          <div className="lp-timeline" ref={timelineRef}>
            {/* Connecting line */}
            <motion.div
              className="lp-timeline-line"
              variants={lineVariants}
              initial="hidden"
              animate={timelineInView ? 'visible' : 'hidden'}
              style={{ transformOrigin: 'left' }}
            />
            {STEPS.map((s) => (
              <TimelineNode key={s.num} num={s.num} title={s.title} desc={s.desc} />
            ))}
          </div>
        </SectionReveal>
      </section>

      {/* ── COMPARISON ── */}
      <section className="lp-section lp-section-dark">
        <SectionReveal className="lp-contain">
          <motion.p variants={revealVariants} className="lp-eyebrow lp-eyebrow-dim lp-text-center">AUTOPAY VS TRADITIONAL</motion.p>
          <motion.h2 variants={revealVariants} className="lp-h2 lp-h2-light">
            Half the cost.{' '}
            <em>None of the risk.</em>
          </motion.h2>
          <div className="lp-compare">
            <motion.div variants={revealVariants} className="lp-compare-row lp-compare-head">
              <span />
              <span className="lp-compare-us-head">AutoPay</span>
              <span className="lp-compare-them-head">Traditional</span>
            </motion.div>
            {ROWS.map((r) => (
              <motion.div key={r.label} variants={revealVariants} className="lp-compare-row">
                <span className="lp-compare-label">{r.label}</span>
                <span className="lp-compare-us"><span className="lp-compare-pill"><Check size={14} strokeWidth={3} className="lp-icon-check" /> {r.us}</span></span>
                <span className="lp-compare-them"><X size={14} strokeWidth={2.5} className="lp-icon-x" /> {r.them}</span>
              </motion.div>
            ))}
          </div>
        </SectionReveal>
      </section>

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
          <div className="lp-footer-left">
            <img src="/logo.png" alt="" className="lp-footer-logo" />
            <span className="lp-footer-copy">&copy; {new Date().getFullYear()} AutoPay Protocol</span>
          </div>
          <div className="lp-footer-links">
            <button onClick={onDocs} className="lp-footer-link"><BookOpen size={13} /> Docs</button>
            <a href="https://github.com/apeoverflow/auto-pay-protocol" target="_blank" rel="noopener noreferrer" className="lp-footer-link"><Github size={13} /> GitHub</a>
            <a href="https://www.npmjs.com/package/@autopayprotocol/sdk" target="_blank" rel="noopener noreferrer" className="lp-footer-link"><Package size={13} /> SDK</a>
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
          --dark: #0E0E10;
          --green: #16A34A;
          --red: #DC2626;
          --sans: 'DM Sans', system-ui, -apple-system, sans-serif;
          --serif: 'Instrument Serif', Georgia, serif;
          --ease: cubic-bezier(0.16, 1, 0.3, 1);

          min-height: 100vh;
          background: var(--bg);
          color: var(--fg);
          font-family: var(--sans);
          overflow-x: hidden;
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
          animation: followArc var(--dur, 18s) var(--delay, 0s) linear infinite;
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
          animation: coinWobble ease-in-out infinite;
          position: relative;
          transform: perspective(120px) rotateX(var(--tiltX, 0deg)) rotateY(var(--tiltY, 0deg));
        }
        /* ── faux-3D coin edge (visible rim) ── */
        .lp-coin-body::before {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          background: conic-gradient(
            from var(--edge, 150deg),
            #0a3a6e 0deg,
            #155ea0 60deg,
            #1a6fbf 120deg,
            #155ea0 200deg,
            #0a3a6e 280deg,
            #072b54 360deg
          );
          z-index: -1;
        }
        /* ── directional shadow (offset matches tilt) ── */
        .lp-coin-body::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          box-shadow:
            3px 4px 8px rgba(10,40,80,0.4),
            5px 8px 18px rgba(10,40,80,0.18),
            1px 2px 3px rgba(10,40,80,0.25);
          z-index: -1;
        }
        /* per-coin shadow direction matching tilt */
        .lp-arc-0 .lp-coin-body::after {
          box-shadow: -5px 6px 10px rgba(10,40,80,0.4), -7px 10px 22px rgba(10,40,80,0.2), -2px 3px 4px rgba(10,40,80,0.3);
        }
        .lp-arc-1 .lp-coin-body::after {
          box-shadow: 5px 7px 10px rgba(10,40,80,0.4), 8px 12px 22px rgba(10,40,80,0.2), 2px 3px 4px rgba(10,40,80,0.3);
        }
        .lp-arc-2 .lp-coin-body::after {
          box-shadow: -4px 5px 10px rgba(10,40,80,0.4), -5px 9px 22px rgba(10,40,80,0.2), -1px 3px 4px rgba(10,40,80,0.3);
        }
        /* ── lighting overlay on the face ── */
        .lp-coin-body img {
          display: block;
          border-radius: 50%;
          position: relative;
          z-index: 1;
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

        @keyframes coinWobble {
          0%   { transform: perspective(120px) rotateX(var(--tiltX, 0deg)) rotateY(var(--tiltY, 0deg)) rotate(-2deg) scale(1); }
          33%  { transform: perspective(120px) rotateX(calc(var(--tiltX, 0deg) + 3deg)) rotateY(calc(var(--tiltY, 0deg) - 2deg)) rotate(2deg) scale(1.03); }
          66%  { transform: perspective(120px) rotateX(calc(var(--tiltX, 0deg) - 2deg)) rotateY(calc(var(--tiltY, 0deg) + 3deg)) rotate(-1deg) scale(0.98); }
          100% { transform: perspective(120px) rotateX(var(--tiltX, 0deg)) rotateY(var(--tiltY, 0deg)) rotate(-2deg) scale(1); }
        }

        /* ── aura mist system ── */
        .lp-mist {
          position: absolute;
          border-radius: 50%;
          filter: blur(65px);
          animation: mistBreathe 9s ease-in-out infinite;
          transform: translate(-50%, -50%);
          opacity: 0.5;
        }
        .lp-mist-2 {
          left: 585px; top: 340px;
          width: 240px; height: 240px;
          background: radial-gradient(circle, rgba(39,117,202,0.14), rgba(80,140,220,0.05) 50%, transparent 70%);
          animation-delay: -1.8s;
        }
        .lp-mist-3 {
          left: 700px; top: 220px;
          width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(39,117,202,0.10), rgba(100,160,230,0.04) 50%, transparent 70%);
          animation-delay: -3.5s;
        }
        .lp-mist-5 {
          left: 700px; top: 40px;
          width: 240px; height: 160px;
          background: radial-gradient(ellipse, rgba(39,117,202,0.16), rgba(100,160,230,0.06) 45%, transparent 65%);
          animation-delay: -2s;
          animation-duration: 7s;
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
          animation: tendrilDrift 10s ease-in-out infinite;
        }
        .lp-tendril-1 {
          left: 620px; top: 380px;
          width: 120px; height: 40px;
          background: rgba(39,117,202,0.14);
          animation-delay: -1s;
          animation-duration: 9s;
        }
        .lp-tendril-3 {
          left: 710px; top: 90px;
          width: 140px; height: 30px;
          background: rgba(39,117,202,0.16);
          animation-delay: -7s;
          animation-duration: 8s;
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
          animation: shimmerFirefly 22s -8s linear infinite;
        }
        .lp-shimmer-firefly .lp-shimmer-core {
          width: 3px; height: 3px;
          background: rgba(160,200,255,0.8);
          box-shadow: 0 0 8px 3px rgba(39,117,202,0.5);
          animation: fireflyBlink 2.5s ease-in-out infinite;
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
        @keyframes shimmerFirefly {
          0%   { offset-distance: 0%;   opacity: 0; }
          6%   { offset-distance: 3%;   opacity: 0.7; }
          30%  { offset-distance: 14%;  opacity: 0.8; }
          55%  { offset-distance: 28%;  opacity: 0.8; }
          75%  { offset-distance: 42%;  opacity: 0.8; }
          87%  { offset-distance: 60%;  opacity: 0.7; }
          93%  { offset-distance: 82%;  opacity: 0.4; }
          97%  { offset-distance: 95%;  opacity: 0.15; }
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
          animation: shimmerStreak 4.5s -1s linear infinite;
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
          5%   { offset-distance: 3%;   opacity: 0.8; }
          30%  { offset-distance: 16%;  opacity: 1; }
          55%  { offset-distance: 30%;  opacity: 1; }
          75%  { offset-distance: 44%;  opacity: 1; }
          87%  { offset-distance: 62%;  opacity: 0.8; }
          93%  { offset-distance: 82%;  opacity: 0.5; }
          97%  { offset-distance: 95%;  opacity: 0.2; }
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
          filter: brightness(0); opacity: 0.7;
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
        }
        .lp-story-inner {
          padding: 48px 40px;
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
          .lp-story-inner { padding: 32px 24px; }
          .lp-story-stat { padding: 0 20px; }
          .lp-story-stat-val { font-size: 22px; }
        }

        /* ── case studies (two-column) ── */
        .lp-cases {
          display: grid; grid-template-columns: 1fr; gap: 16px;
        }
        @media (min-width: 768px) { .lp-cases { grid-template-columns: repeat(2, 1fr); } }

        .lp-case-card {
          background: #fff;
          border-radius: 20px;
          border: 1px solid rgba(0,0,0,0.06);
          padding: 32px 28px;
          display: flex;
          flex-direction: column;
        }
        .lp-case-head {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 16px;
        }
        .lp-case-icon { color: var(--blue); }
        .lp-case-tag {
          font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
          color: var(--blue); opacity: 0.6;
        }
        .lp-case-title {
          font-size: 18px; font-weight: 660; letter-spacing: -0.02em;
          line-height: 1.35; margin: 0 0 24px; color: var(--fg);
        }
        .lp-case-title em {
          font-family: var(--serif); font-style: italic;
          font-weight: 400; color: var(--blue);
        }
        .lp-case-note {
          font-size: 13px; line-height: 1.6; color: var(--muted); margin: 0;
          margin-top: auto; padding-top: 16px;
        }
        .lp-case-note strong { color: var(--blue); font-weight: 650; }

        /* ── fee waterfall visual ── */
        .lp-waterfall {
          display: flex; flex-direction: column; gap: 0;
          margin-bottom: 20px;
        }
        .lp-wf-row {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid rgba(0,0,0,0.04);
          position: relative;
        }
        .lp-wf-row-result {
          border-bottom: none;
          padding-top: 14px;
          border-top: 2px solid rgba(0,0,0,0.08);
        }
        .lp-wf-label {
          font-size: 12.5px; font-weight: 500; color: var(--muted);
        }
        .lp-wf-amount {
          font-size: 13px; font-weight: 650; color: var(--fg);
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.01em;
        }
        .lp-wf-cut { color: var(--red); }
        .lp-wf-final { font-size: 15px; }
        .lp-wf-bar {
          position: absolute;
          bottom: 0; left: 0;
          height: 2px;
          width: 100%;
          border-radius: 1px;
        }
        .lp-wf-alt {
          margin-top: 12px;
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 14px;
          background: rgba(0,82,255,0.04);
          border: 1px solid rgba(0,82,255,0.08);
          border-radius: 10px;
        }
        .lp-wf-alt-label {
          font-size: 12.5px; font-weight: 600; color: var(--blue);
        }
        .lp-wf-alt-amount {
          font-size: 17px; font-weight: 750; color: var(--blue);
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }

        /* ── geography grid ── */
        .lp-geo-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-bottom: 20px;
        }
        .lp-geo-item {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 12px;
          background: rgba(0,0,0,0.02);
          border-radius: 10px;
          border: 1px solid rgba(0,0,0,0.04);
        }
        .lp-geo-flag { font-size: 16px; }
        .lp-geo-city {
          font-size: 13px; font-weight: 600; color: var(--fg);
          flex: 1;
        }
        .lp-geo-status {
          font-size: 10px; font-weight: 650; letter-spacing: 0.02em;
          color: var(--red); opacity: 0.7;
          text-transform: uppercase;
        }

        .lp-geo-vs {
          display: flex; flex-direction: column; gap: 8px;
          margin-bottom: 16px;
        }
        .lp-geo-vs-row {
          display: flex; align-items: flex-start; gap: 8px;
          font-size: 13px; line-height: 1.5;
        }
        .lp-geo-vs-row svg { flex-shrink: 0; margin-top: 2px; }
        .lp-geo-vs-bad { color: rgba(0,0,0,0.35); }
        .lp-geo-vs-bad svg { color: var(--red); opacity: 0.5; }
        .lp-geo-vs-good { color: var(--fg); font-weight: 600; }
        .lp-geo-vs-good svg { color: var(--green); }

        .lp-geo-stat-callout {
          display: flex; align-items: baseline; gap: 10px;
          padding: 14px 16px;
          background: rgba(0,82,255,0.04);
          border: 1px solid rgba(0,82,255,0.08);
          border-radius: 10px;
          margin-bottom: 12px;
        }
        .lp-geo-stat-num {
          font-size: 24px; font-weight: 750; color: var(--blue);
          letter-spacing: -0.02em;
          flex-shrink: 0;
        }
        .lp-geo-stat-text {
          font-size: 13px; line-height: 1.45; color: var(--muted);
          font-weight: 500;
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
          height: 24px;
          width: 24px;
          object-fit: contain;
          opacity: 0.4;
          border-radius: 4px;
          transition: opacity 0.2s;
        }
        .lp-partner-name {
          font-size: 14px;
          font-weight: 620;
          color: var(--fg);
          letter-spacing: -0.01em;
          opacity: 0.35;
          transition: opacity 0.2s;
        }
        .lp-partner-item:hover .lp-partner-name { opacity: 0.8; }
        .lp-partner-item:hover .lp-partner-logo { opacity: 0.85; }
        .lp-partner-dot {
          width: 3px; height: 3px; border-radius: 50%;
          background: rgba(0,0,0,0.15);
          margin: 0 18px;
          flex-shrink: 0;
          opacity: 0.4;
        }
        @media (max-width: 639px) {
          .lp-partners { padding: 32px 0 24px; }
          .lp-ticker-track { animation-duration: 25s; }
          .lp-partner-dot { margin: 0 12px; }
          .lp-partner-name { font-size: 13px; }
          .lp-partner-logo { height: 20px; width: 20px; }
        }

        /* ── timeline (how it works) ── */
        .lp-timeline {
          position: relative;
          display: grid;
          grid-template-columns: 1fr;
          gap: 32px;
        }
        @media (min-width: 768px) {
          .lp-timeline {
            grid-template-columns: repeat(3, 1fr);
            gap: 0;
          }
        }

        .lp-timeline-line {
          display: none;
        }
        @media (min-width: 768px) {
          .lp-timeline-line {
            display: block;
            position: absolute;
            top: 28px;
            left: calc(16.67%);
            right: calc(16.67%);
            height: 2px;
            background: linear-gradient(90deg, var(--blue), rgba(0,82,255,0.3));
            box-shadow: 0 0 8px rgba(0,82,255,0.2);
            z-index: 0;
          }
        }

        .lp-timeline-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          position: relative;
          z-index: 1;
        }

        .lp-timeline-circle {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--blue);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.02em;
          box-shadow: 0 0 0 4px var(--bg), 0 0 16px rgba(0,82,255,0.2);
          margin-bottom: 20px;
          cursor: default;
        }

        .lp-timeline-title {
          font-size: 18px;
          font-weight: 650;
          letter-spacing: -0.015em;
          margin: 0 0 8px;
        }

        .lp-timeline-desc {
          font-size: 14px;
          line-height: 1.6;
          color: var(--muted);
          margin: 0;
          max-width: 260px;
        }

        /* mobile timeline: vertical layout with line on left */
        @media (max-width: 767px) {
          .lp-timeline {
            padding-left: 44px;
            position: relative;
          }
          .lp-timeline::before {
            content: '';
            position: absolute;
            left: 28px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: linear-gradient(to bottom, var(--blue), rgba(0,82,255,0.2));
          }
          .lp-timeline-node {
            align-items: flex-start;
            text-align: left;
          }
          .lp-timeline-circle {
            position: absolute;
            left: -44px;
            width: 40px;
            height: 40px;
            font-size: 12px;
            box-shadow: 0 0 0 3px var(--bg), 0 0 12px rgba(0,82,255,0.15);
          }
          .lp-timeline-desc {
            max-width: none;
          }
        }

        /* ── comparison ── */
        .lp-section-dark {
          background: var(--dark); color: #fff;
        }
        .lp-eyebrow-dim { color: rgba(255,255,255,0.35); }
        .lp-compare { max-width: 640px; margin: 0 auto; }
        .lp-compare-row {
          display: grid; grid-template-columns: 1.1fr 1fr 1fr; gap: 12px;
          padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.07);
          font-size: 14px; align-items: center;
        }
        .lp-compare-row:last-child { border-bottom: none; }
        .lp-compare-head {
          font-size: 11px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; padding-bottom: 14px;
          border-bottom: 1px solid rgba(255,255,255,0.12);
        }
        .lp-compare-label { color: rgba(255,255,255,0.4); font-weight: 500; }
        .lp-compare-us, .lp-compare-us-head {
          display: flex; align-items: center; gap: 8px; font-weight: 600; color: #fff;
        }
        .lp-compare-pill {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(0,82,255,0.07);
          padding: 4px 10px;
          border-radius: 6px;
          white-space: nowrap;
        }
        .lp-compare-them, .lp-compare-them-head {
          display: flex; align-items: center; gap: 8px; font-weight: 500; color: rgba(255,255,255,0.3);
        }
        .lp-icon-check { color: var(--green); flex-shrink: 0; }
        .lp-icon-x { color: var(--red); opacity: 0.55; flex-shrink: 0; }

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
        .lp-footer { border-top: 1px solid rgba(0,0,0,0.06); padding: 24px 28px; }
        .lp-footer-inner {
          max-width: 1160px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 16px;
        }
        .lp-footer-left { display: flex; align-items: center; gap: 10px; }
        .lp-footer-logo { height: 32px; width: auto; filter: brightness(0); opacity: 0.4; }
        .lp-footer-copy { font-size: 13px; color: var(--muted); }
        .lp-footer-links { display: flex; align-items: center; gap: 20px; }
        .lp-footer-link {
          display: inline-flex; align-items: center; gap: 5px;
          font-family: var(--sans); font-size: 13px; font-weight: 500;
          color: var(--muted); text-decoration: none;
          border: none; background: none; cursor: pointer; transition: color 0.2s;
        }
        .lp-footer-link:hover { color: var(--fg); }

        /* ── mobile ── */
        @media (max-width: 639px) {
          .lp-hero { padding: 48px 20px 0; }
          .lp-stats-bar { margin-top: 40px; }
          .lp-stat { padding: 0 20px; }
          .lp-stat-val { font-size: 24px; }
          .lp-section { padding: 64px 20px; }
          .lp-compare-row { font-size: 13px; gap: 8px; }
          .lp-cta { padding: 80px 20px; }
        }
      `}</style>
    </div>
  )
}
