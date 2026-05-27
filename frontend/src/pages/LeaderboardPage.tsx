import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Trophy, Star, TrendingUp, Users, Zap, ArrowRight } from 'lucide-react'
import { fetchPointsLeaderboard, type PointsLeaderboardResponse } from '../lib/relayer'
import { useDisplayName } from '../hooks/useEns'

// ── Avatar (same as PointsPage) ──────────────────────────────

const AVATAR_PALETTES = [
  ['#FF6B6B', '#EE5A24'], ['#C56CF0', '#6C5CE7'], ['#18DCFF', '#7158E2'],
  ['#FFC312', '#F79F1F'], ['#12CBC4', '#1289A7'], ['#FDA7DF', '#D980FA'],
  ['#ED4C67', '#B53471'], ['#A3CB38', '#009432'], ['#0652DD', '#1B1464'],
  ['#6F1E51', '#833471'], ['#EE5A24', '#EA2027'], ['#009432', '#006266'],
  ['#1289A7', '#0652DD'], ['#9980FA', '#5758BB'], ['#FFC312', '#12CBC4'],
  ['#FDA7DF', '#ED4C67'],
]

function addressToSeed(address: string): number {
  let hash = 0
  const clean = address.toLowerCase().replace('0x', '')
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) - hash + clean.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function AddressAvatar({ address, size = 32 }: { address: string; size?: number }) {
  const seed = addressToSeed(address)
  const palette = AVATAR_PALETTES[seed % AVATAR_PALETTES.length]
  const cx = 30 + (seed % 40)
  const cy = 30 + ((seed >> 8) % 40)
  const r = 20 + ((seed >> 4) % 20)
  const angle = seed % 360

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="rounded-full shrink-0">
      <defs>
        <linearGradient id={`lb-${address.slice(2, 8)}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette[0]} />
          <stop offset="100%" stopColor={palette[1]} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#lb-${address.slice(2, 8)})`} />
      <circle cx={cx} cy={cy} r={r} fill={palette[1]} opacity="0.6" />
      <circle cx={100 - cx} cy={100 - cy} r={r * 0.7} fill={palette[0]} opacity="0.4" />
      <rect x={cx - 10} y={cy - 10} width={r} height={r} rx={r * 0.3} fill="white" opacity="0.15" transform={`rotate(${angle} 50 50)`} />
    </svg>
  )
}

// ── Helpers ──────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-800 border-amber-300',
  silver: 'bg-gray-100 text-gray-700 border-gray-300',
  gold: 'bg-yellow-100 text-yellow-800 border-yellow-400',
  diamond: 'bg-blue-100 text-blue-700 border-blue-400',
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${TIER_COLORS[tier] || TIER_COLORS.bronze}`}>
      {tier}
    </span>
  )
}

const truncAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`

function WalletName({ address }: { address: string }) {
  const { displayName, isEns } = useDisplayName(address)
  return <span style={{ fontFamily: isEns ? 'inherit' : 'monospace', fontWeight: isEns ? 500 : 400, fontSize: 12, color: '#1D1D1F' }}>{displayName}</span>
}
const fmtVol = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`
const fmtPts = (p: number) => p >= 10000 ? `${(p / 1000).toFixed(1)}k` : p.toLocaleString()

// ── Page ─────────────────────────────────────────────────────

const EPOCHS = [
  { name: 'Genesis', start: '2026-03-01', end: '2026-05-31' },
  { name: 'Ignition', start: '2026-06-01', end: '2026-08-31' },
  { name: 'Expansion', start: '2026-09-01', end: '2026-11-30' },
  { name: 'Velocity', start: '2026-12-01', end: '2027-02-28' },
  { name: 'Orbit', start: '2027-03-01', end: '2027-05-31' },
  { name: 'Gravity', start: '2027-06-01', end: '2027-08-31' },
  { name: 'Nova', start: '2027-09-01', end: '2027-11-30' },
  { name: 'Apex', start: '2027-12-01', end: '2028-02-29' },
  { name: 'Horizon', start: '2028-03-01', end: '2028-05-31' },
  { name: 'Convergence', start: '2028-06-01', end: '2028-08-31' },
]

function getCurrentEpoch() {
  const now = new Date().toISOString().slice(0, 10)
  const idx = EPOCHS.findIndex(e => now >= e.start && now <= e.end)
  if (idx === -1) return null
  const epoch = EPOCHS[idx]
  const daysLeft = Math.max(0, Math.ceil((new Date(epoch.end + 'T23:59:59Z').getTime() - Date.now()) / 86400000))
  return { ...epoch, number: idx + 1, daysLeft }
}

export function LeaderboardPage() {
  const [period, setPeriod] = useState<'all' | 'monthly' | 'weekly'>('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PointsLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const epoch = getCurrentEpoch()

  useEffect(() => {
    setLoading(true)
    fetchPointsLeaderboard(period, page, 50)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period, page])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#F5F5F7', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ background: 'white', borderBottom: '1px solid rgba(0,0,0,0.06)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logos/autopay-icon-white.svg" alt="AutoPay" style={{ height: 26, width: 26, borderRadius: 6, background: '#1D1D1F', padding: 2 }} />
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: '#1D1D1F', margin: 0 }}>Leaderboard</h1>
              <p style={{ fontSize: 12, color: '#86868B', margin: 0 }}>
                {epoch ? `Epoch ${epoch.number}: ${epoch.name} · ${epoch.daysLeft}d remaining` : 'AutoPay Loyalty Points'}
              </p>
            </div>
          </div>
          <a href="/app" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: '#1D1D1F', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            Launch App <ArrowRight size={14} />
          </a>
        </div>
      </header>

      {/* Controls */}
      <div style={{ margin: '0 auto', padding: '10px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: 3 }}>
          {(['all', 'monthly', 'weekly'] as const).map((p) => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setPage(1) }}
              style={{
                padding: '4px 12px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: 'none', cursor: 'pointer',
                background: period === p ? 'white' : 'transparent',
                boxShadow: period === p ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                color: period === p ? '#1D1D1F' : '#86868B',
              }}
            >
              {p === 'all' ? 'All Time' : p === 'monthly' ? 'Monthly' : 'Weekly'}
            </button>
          ))}
        </div>
        {data && (
          <span style={{ fontSize: 12, color: '#86868B' }}>{data.pagination.total} participants</span>
        )}
      </div>

      {/* Table + Sidebar */}
      <div style={{ flex: 1, padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'stretch', width: '100%', minHeight: 0, overflow: 'auto' }}>
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? (
            <div style={{ padding: '80px 0', textAlign: 'center', color: '#86868B' }}>
              <div style={{ width: 24, height: 24, border: '2px solid #0052FF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          ) : !data || data.leaderboard.length === 0 ? (
            <div style={{ padding: '80px 0', textAlign: 'center' }}>
              <Trophy size={32} style={{ color: '#86868B', margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: '#1D1D1F', margin: '0 0 4px' }}>No one on the board yet</p>
              <p style={{ fontSize: 13, color: '#86868B', margin: 0 }}>Be the first — subscribe to a plan to start earning points.</p>
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#FAFAFA' }}>
                    <th style={{ padding: '7px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#86868B', width: 60 }}>#</th>
                    <th style={{ padding: '7px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#86868B' }}>Address</th>
                    <th style={{ padding: '7px 16px', textAlign: 'right', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#86868B' }}>Volume</th>
                    <th style={{ padding: '7px 16px', textAlign: 'right', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#86868B' }}>Points</th>
                    <th style={{ padding: '7px 16px', textAlign: 'center', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#86868B' }}>Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard.map((entry) => (
                    <tr key={entry.wallet} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                      <td style={{ padding: '8px 16px' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: entry.rank <= 3 ? '#0052FF' : '#86868B' }}>{entry.rank}</span>
                      </td>
                      <td style={{ padding: '8px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <AddressAvatar address={entry.wallet} size={24} />
                          <WalletName address={entry.wallet} />
                        </div>
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: 12, color: '#86868B' }}>{fmtVol(entry.total_usdc_volume)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#1D1D1F' }}>{fmtPts(entry.points)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'center' }}><TierBadge tier={entry.tier} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '8px 16px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page <= 1}
                  style={{ padding: '4px 8px', border: 'none', background: 'none', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.3 : 1 }}
                >
                  <ChevronLeft size={18} />
                </button>
                <span style={{ fontSize: 13, color: '#86868B', fontVariantNumeric: 'tabular-nums' }}>
                  Page {page} of {data.pagination.total_pages || 1}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= (data.pagination.total_pages || 1)}
                  style={{ padding: '4px 8px', border: 'none', background: 'none', cursor: page >= (data.pagination.total_pages || 1) ? 'default' : 'pointer', opacity: page >= (data.pagination.total_pages || 1) ? 0.3 : 1 }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Sidebar — How to earn */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { icon: <TrendingUp size={20} strokeWidth={2.5} />, title: '10 pts per $1', desc: 'Every USDC charge earns points for both payer and merchant.', gradient: 'linear-gradient(135deg, #0052FF 0%, #3B82F6 100%)', bg: 'linear-gradient(135deg, rgba(0,82,255,0.08), rgba(59,130,246,0.04))' },
            { icon: <Users size={20} strokeWidth={2.5} />, title: 'Invite & Earn', desc: 'Share your referral link. Earn 10 pts/$1 on their first charge.', gradient: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)', bg: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(167,139,250,0.04))' },
            { icon: <Zap size={20} strokeWidth={2.5} />, title: 'Milestones', desc: 'First subscription: +100 pts. Loyalty bonuses at 1, 3, and 6 months.', gradient: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)', bg: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(251,191,36,0.04))' },
            { icon: <Star size={20} strokeWidth={2.5} />, title: 'Tier Up', desc: 'Bronze → Silver (2.5k) → Gold (10k) → Diamond (50k pts).', gradient: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)', bg: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(52,211,153,0.04))' },
          ].map((f) => (
            <div key={f.title} style={{
              flex: 1,
              padding: '20px 22px', borderRadius: 16,
              background: f.bg,
              border: '1px solid rgba(0,0,0,0.04)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: f.gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', marginBottom: 10,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}>
                {f.icon}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', marginBottom: 5, letterSpacing: '-0.01em' }}>{f.title}</div>
              <div style={{ fontSize: 13, color: '#86868B', lineHeight: 1.55 }}>{f.desc}</div>
            </div>
          ))}

        </div>
      </div>
    </div>
  )
}
