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
  { label: 'Subscriber pays', amount: '$10.00', numVal: 10.00, pct: 100 },
  { label: 'Patreon / Discord takes 8–10%', amount: '−$0.80', numVal: -0.80, pct: 92 },
  { label: 'Stripe takes 2.9% + 30¢', amount: '−$0.59', numVal: -0.59, pct: 86.1 },
  { label: 'Creator keeps', amount: '$8.61', numVal: 8.61, pct: 86.1 },
]

function AnimatedAmount({ value, prefix, inView, prefersReduced, delay }: { value: number; prefix?: string; inView: boolean; prefersReduced: boolean | null; delay: number }) {
  const [display, setDisplay] = useState(prefersReduced ? value.toFixed(2) : '0.00')
  useEffect(() => {
    if (!inView || prefersReduced) {
      setDisplay(value.toFixed(2))
      return
    }
    const ctrl = animate(0, value, {
      duration: 0.8,
      delay,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v.toFixed(2)),
    })
    return () => ctrl.stop()
  }, [inView, value, delay, prefersReduced])
  return <>{prefix}${display}</>
}

function FeeWaterfall() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.3 })
  const prefersReduced = useReducedMotion()
  const prevPcts = [100, 100, 92] // previous row's pct for computing red slice
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
            {/* Proportional background bar */}
            <motion.div
              className="lp-wf-bg-bar"
              initial={{ scaleX: 0 }}
              animate={inView || prefersReduced ? { scaleX: step.pct / 100 } : { scaleX: 0 }}
              transition={{ type: 'spring', damping: 16, stiffness: 100, delay: i * 0.12 + 0.05 }}
              style={{ transformOrigin: 'left' }}
            />
            {/* Red slice showing removed portion */}
            {isCut && (
              <motion.div
                className="lp-wf-red-slice"
                initial={{ scaleX: 0, opacity: 0 }}
                animate={inView || prefersReduced ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 16, stiffness: 100, delay: i * 0.12 + 0.15 }}
                style={{ transformOrigin: 'right', left: `${step.pct}%`, width: `${prevPcts[i] - step.pct}%` }}
              />
            )}
            <span className="lp-wf-label">{step.label}</span>
            <span className={`lp-wf-amount ${isCut ? 'lp-wf-cut' : ''} ${isLast ? 'lp-wf-final' : ''}`}>
              {isLast ? (
                <AnimatedAmount value={8.61} prefix="" inView={inView} prefersReduced={prefersReduced} delay={i * 0.12} />
              ) : (
                step.amount
              )}
            </span>
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
        <span className="lp-wf-alt-amount-wrap">
          <span className="lp-wf-alt-amount">
            <AnimatedAmount value={9.75} prefix="" inView={inView} prefersReduced={prefersReduced} delay={0.65} />
          </span>
          <span className="lp-wf-savings">+$1.14/mo</span>
        </span>
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
      d: 2.4 + rand() * 2.0,
      dl: rand() * 3.0,
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
  for (let i = 0; i < 28; i++) {
    // alternate left gutter (0-10%) and right gutter (90-100%)
    const side = i % 2 === 0
    const x = side ? rand() * 10 : 90 + rand() * 10
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

          {/* ── Two-column case studies ── */}
          <motion.div className="lp-cases" variants={containerVariants}>
            {/* Left: Fee waterfall */}
            <TiltCard className="lp-case-card lp-case-fee">
              <div className="lp-case-head">
                <BadgePercent size={16} strokeWidth={2.5} className="lp-case-icon" />
                <span className="lp-case-tag">CASE STUDY</span>
              </div>
              <h3 className="lp-case-title">
                1,000 subscribers on Patreon or Discord?<br />
                You're leaving <em>$13,680/yr</em> on the table.
              </h3>
              <FeeWaterfall />
              <p className="lp-case-note">
                At 1,000 subs × $10/mo, Patreon or Discord + Stripe keeps $8.61 per subscriber.
                AutoPay keeps $9.75. That's <strong>$1,140/mo more</strong> — or
                $13,680 per year back in your pocket.
              </p>
            </TiltCard>

            {/* Right: Geography exclusion */}
            <TiltCard className="lp-case-card lp-case-geo">
              <div className="lp-case-head">
                <Globe size={16} strokeWidth={2.5} className="lp-case-icon lp-case-icon-geo" />
                <span className="lp-case-tag lp-case-tag-geo">CASE STUDY</span>
              </div>
              <h3 className="lp-case-title">
                Creators in Lagos, Bogotá, and Dhaka<br />
                <em>can't even access</em> Stripe.
              </h3>
              <div className="lp-geo-grid" aria-hidden="true">
                {([
                  { city: 'Lagos', status: 'Restricted', color: '#DC2626' },
                  { city: 'Bogotá', status: 'Restricted', color: '#DC2626' },
                  { city: 'Dhaka', status: 'Unavailable', color: '#DC2626' },
                  { city: 'Nairobi', status: 'Limited', color: '#D97706' },
                ] as const).map((c) => (
                  <div key={c.city} className="lp-geo-item" style={{ borderLeftColor: c.color }}>
                    <span className="lp-geo-dot" style={{ background: c.color }} />
                    <span className="lp-geo-city">{c.city}</span>
                    <span className="lp-geo-status-pill" style={{ background: c.color === '#D97706' ? 'rgba(217,119,6,0.12)' : 'rgba(220,38,38,0.10)', color: c.color }}>
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
              <div className="lp-geo-vs">
                <div className="lp-geo-vs-card lp-geo-vs-stripe">
                  <div className="lp-geo-vs-card-head">
                    <X size={14} strokeWidth={2.5} />
                    <span>Stripe</span>
                  </div>
                  <span className="lp-geo-vs-card-line lp-geo-vs-strike">Bank account required</span>
                  <span className="lp-geo-vs-card-line lp-geo-vs-strike">Geography-gated</span>
                  <span className="lp-geo-vs-card-line lp-geo-vs-strike">4–7% fees</span>
                </div>
                <div className="lp-geo-vs-card lp-geo-vs-autopay">
                  <div className="lp-geo-vs-card-head">
                    <Check size={14} strokeWidth={3} />
                    <span>AutoPay</span>
                  </div>
                  <span className="lp-geo-vs-card-line">Any wallet</span>
                  <span className="lp-geo-vs-card-line">Any country</span>
                  <span className="lp-geo-vs-card-line">2.5% flat</span>
                </div>
              </div>
              <div className="lp-geo-stat-callout">
                <span className="lp-geo-stat-num">195+</span>
                <span className="lp-geo-stat-text">countries with crypto wallet access — vs 46 with full Stripe support</span>
              </div>
              <p className="lp-case-note">
                Any wallet. Any country. Same rate.
              </p>
            </TiltCard>
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
            {/* Terminal diff comparison */}
            <motion.div className="lp-diff" variants={containerVariants}>
              <div className="lp-diff-chrome">
                <div className="lp-diff-dots">
                  <span className="lp-diff-dot lp-diff-dot--r" />
                  <span className="lp-diff-dot lp-diff-dot--y" />
                  <span className="lp-diff-dot lp-diff-dot--g" />
                </div>
                <span className="lp-diff-title">compare --autopay --traditional</span>
              </div>
              <div className="lp-diff-body">
                {ROWS.map((r) => (
                  <motion.div key={r.label} variants={revealVariants} className="lp-diff-block">
                    <div className="lp-diff-comment"><span className="lp-diff-slashes">{'//'}</span> {r.label}</div>
                    <div className="lp-diff-add"><span className="lp-diff-sign">+</span> {r.us}</div>
                    <div className="lp-diff-del"><span className="lp-diff-sign">−</span> <span className="lp-diff-struck">{r.them}</span></div>
                  </motion.div>
                ))}
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
          display: grid; grid-template-columns: 1fr; gap: 16px;
          max-width: 100%; overflow: hidden;
        }
        @media (min-width: 768px) { .lp-cases { grid-template-columns: repeat(2, 1fr); } }

        .lp-case-card {
          background: #fff;
          border-radius: 20px;
          border: 1px solid rgba(0,0,0,0.06);
          padding: 32px 28px;
          display: flex;
          flex-direction: column;
          border-top: 2px solid var(--blue);
          transition: box-shadow 0.3s ease;
          overflow: hidden;
          min-width: 0;
        }
        .lp-case-fee { border-top-color: var(--blue); }
        .lp-case-geo { border-top-color: var(--green); }
        .lp-case-fee:hover { box-shadow: 0 12px 48px rgba(0,82,255,0.08); }
        .lp-case-geo:hover { box-shadow: 0 12px 48px rgba(22,163,74,0.08); }
        .lp-case-head {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 16px;
        }
        .lp-case-icon { color: var(--blue); }
        .lp-case-icon-geo { color: var(--green); }
        .lp-case-tag {
          font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
          color: var(--blue); opacity: 0.6;
        }
        .lp-case-tag-geo { color: var(--green); }
        .lp-case-title {
          font-size: 20px; font-weight: 660; letter-spacing: -0.02em;
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
          padding: 10px 12px;
          border-bottom: 1px solid rgba(0,0,0,0.04);
          position: relative;
          overflow: hidden;
          z-index: 0;
        }
        .lp-wf-bg-bar {
          position: absolute;
          top: 0; left: 0; bottom: 0;
          width: 100%;
          background: rgba(0,0,0,0.03);
          z-index: -1;
          border-radius: 0 4px 4px 0;
        }
        .lp-wf-red-slice {
          position: absolute;
          top: 0; bottom: 0;
          background: rgba(220,38,38,0.08);
          z-index: -1;
          border-radius: 0 4px 4px 0;
        }
        .lp-wf-row-result {
          border-bottom: none;
          padding-top: 14px;
          border-top: 2px solid rgba(0,0,0,0.08);
        }
        .lp-wf-label {
          font-size: 12.5px; font-weight: 500; color: var(--muted);
          position: relative; z-index: 1;
        }
        .lp-wf-amount {
          font-size: 13px; font-weight: 650; color: var(--fg);
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.01em;
          position: relative; z-index: 1;
        }
        .lp-wf-cut { color: var(--red); }
        .lp-wf-final { font-size: 15px; }
        .lp-wf-alt {
          margin-top: 12px;
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px 16px;
          background: rgba(0,82,255,0.04);
          border-left: 3px solid var(--blue);
          border-radius: 10px;
          border-top: 1px solid rgba(0,82,255,0.08);
          border-right: 1px solid rgba(0,82,255,0.08);
          border-bottom: 1px solid rgba(0,82,255,0.08);
        }
        .lp-wf-alt-label {
          font-size: 12.5px; font-weight: 600; color: var(--blue);
        }
        .lp-wf-alt-amount-wrap {
          display: flex; align-items: center; gap: 8px;
        }
        .lp-wf-alt-amount {
          font-size: 20px; font-weight: 750; color: var(--blue);
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }
        .lp-wf-savings {
          font-size: 11px; font-weight: 650;
          color: var(--green);
          background: rgba(22,163,74,0.08);
          padding: 2px 8px;
          border-radius: 20px;
          letter-spacing: -0.01em;
          white-space: nowrap;
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
          background: rgba(0,0,0,0.015);
          border-radius: 10px;
          border: 1px solid rgba(0,0,0,0.04);
          border-left: 3px solid #DC2626;
        }
        .lp-geo-dot {
          width: 7px; height: 7px; border-radius: 50%;
          flex-shrink: 0;
        }
        .lp-geo-city {
          font-size: 13px; font-weight: 600; color: var(--fg);
          flex: 1;
        }
        .lp-geo-status-pill {
          font-size: 9.5px; font-weight: 700; letter-spacing: 0.02em;
          text-transform: uppercase;
          padding: 2px 7px;
          border-radius: 20px;
          white-space: nowrap;
        }

        .lp-geo-vs {
          display: flex; gap: 8px;
          margin-bottom: 16px;
        }
        @media (max-width: 639px) { .lp-geo-vs { flex-direction: column; } }
        .lp-geo-vs-card {
          flex: 1;
          padding: 14px;
          border-radius: 10px;
          display: flex; flex-direction: column; gap: 4px;
        }
        .lp-geo-vs-stripe {
          background: rgba(220,38,38,0.035);
          border: 1px solid rgba(220,38,38,0.12);
        }
        .lp-geo-vs-autopay {
          background: rgba(0,82,255,0.035);
          border: 1px solid rgba(0,82,255,0.12);
        }
        .lp-geo-vs-card-head {
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 700; margin-bottom: 4px;
        }
        .lp-geo-vs-stripe .lp-geo-vs-card-head { color: var(--red); }
        .lp-geo-vs-stripe .lp-geo-vs-card-head svg { color: var(--red); }
        .lp-geo-vs-autopay .lp-geo-vs-card-head { color: var(--blue); }
        .lp-geo-vs-autopay .lp-geo-vs-card-head svg { color: var(--blue); }
        .lp-geo-vs-card-line {
          font-size: 12px; line-height: 1.5; color: var(--fg);
          font-weight: 500;
        }
        .lp-geo-vs-strike {
          text-decoration: line-through;
          color: var(--muted);
        }
        .lp-geo-vs-autopay .lp-geo-vs-card-line { font-weight: 600; }

        .lp-geo-stat-callout {
          display: flex; align-items: baseline; gap: 10px;
          padding: 14px 16px;
          background: rgba(22,163,74,0.04);
          border: 1px solid rgba(22,163,74,0.08);
          border-radius: 10px;
          margin-bottom: 12px;
        }
        .lp-geo-stat-num {
          font-size: 34px; font-weight: 750; color: var(--green);
          letter-spacing: -0.03em;
          flex-shrink: 0;
          position: relative;
        }
        .lp-geo-stat-num::after {
          content: '';
          position: absolute;
          bottom: -2px; left: 0;
          width: 40px; height: 2px;
          background: var(--green);
          border-radius: 1px;
          opacity: 0.5;
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

        .lp-section-dark > *:not(.lp-dark-aurora) { position: relative; z-index: 1; }

        .lp-eyebrow-dim { color: rgba(255,255,255,0.35); }
        .lp-cmp-block { padding-top: 0; }

        /* ── comparison: terminal diff ── */
        .lp-diff {
          max-width: 680px;
          margin: 0 auto;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(0,0,0,0.4);
          font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
          position: relative;
        }
        .lp-diff::before {
          content: '';
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 200px 200px;
          opacity: 0.02;
          pointer-events: none; z-index: 0;
          border-radius: inherit;
        }
        .lp-diff > * { position: relative; z-index: 1; }

        .lp-diff-chrome {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
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
          color: rgba(255,255,255,0.3);
          letter-spacing: 0.02em;
        }

        .lp-diff-body {
          padding: 20px 24px;
        }
        .lp-diff-block {
          margin-bottom: 6px;
        }
        .lp-diff-comment {
          font-size: 12px;
          line-height: 2;
          color: rgba(255,255,255,0.2);
        }
        .lp-diff-slashes {
          color: rgba(255,255,255,0.12);
        }
        .lp-diff-add {
          font-size: 13.5px;
          line-height: 2;
          color: #4ade80;
          font-weight: 500;
          padding-left: 4px;
          border-radius: 3px;
          background: rgba(74,222,128,0.04);
        }
        .lp-diff-del {
          font-size: 12.5px;
          line-height: 2;
          color: rgba(248,113,113,0.45);
          font-weight: 400;
          padding-left: 4px;
          border-radius: 3px;
          background: rgba(248,113,113,0.02);
        }
        .lp-diff-sign {
          display: inline-block;
          width: 16px;
          font-weight: 700;
        }
        .lp-diff-struck {
          text-decoration: line-through;
          text-decoration-color: rgba(248,113,113,0.25);
        }

        .lp-diff-result {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(255,255,255,0.06);
          font-size: 13px;
          line-height: 2;
          color: rgba(255,255,255,0.4);
        }
        .lp-diff-caret {
          color: var(--blue);
          font-weight: 700;
          margin-right: 6px;
        }
        .lp-diff-count {
          color: #4ade80;
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
          .lp-case-card { padding: 24px 20px; }
          .lp-case-title { font-size: 17px; }
          .lp-wf-alt-amount { font-size: 18px; }
          .lp-geo-stat-num { font-size: 28px; }
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
