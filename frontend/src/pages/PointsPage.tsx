import React, { useState, useEffect, useMemo } from 'react'
import { useWallet } from '../hooks/useWallet'
import { useLeaderboard, usePointsBalance, usePointsActions } from '../hooks/usePoints'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import {
  ChevronLeft, ChevronRight, Flame, Trophy, Copy, Check,
  ExternalLink, Share2, Users, Send, ChevronDown, Loader2,
} from 'lucide-react'
import { trackPointsAction, fetchReferralInfo } from '../lib/relayer'
import { useSignMessageCompat } from '../hooks/useSignMessageCompat'
import { useDisplayName } from '../hooks/useEns'

// ── Deterministic avatar from address ────────────────────────

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

function AddressAvatar({ address, size = 28 }: { address: string; size?: number }) {
  const seed = addressToSeed(address)
  const palette = AVATAR_PALETTES[seed % AVATAR_PALETTES.length]
  const angle = (seed % 360)
  // Create a second shape position from different bytes
  const cx = 30 + (seed % 40)
  const cy = 30 + ((seed >> 8) % 40)
  const r = 20 + ((seed >> 4) % 20)

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="rounded-full shrink-0" style={{ background: palette[0] }}>
      <defs>
        <linearGradient id={`ag-${address.slice(2, 8)}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette[0]} />
          <stop offset="100%" stopColor={palette[1]} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#ag-${address.slice(2, 8)})`} />
      <circle cx={cx} cy={cy} r={r} fill={palette[1]} opacity="0.6" />
      <circle cx={100 - cx} cy={100 - cy} r={r * 0.7} fill={palette[0]} opacity="0.4" />
      <rect x={cx - 10} y={cy - 10} width={r} height={r} rx={r * 0.3} fill="white" opacity="0.15" transform={`rotate(${angle} 50 50)`} />
    </svg>
  )
}

// ── Skeleton ─────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted/60 ${className}`} />
}

function LeaderboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border/10">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 bg-card">
          <Skeleton className="w-5 h-4" />
          <Skeleton className="w-[26px] h-[26px] rounded-full" />
          <Skeleton className="w-28 h-4" />
          <div className="flex-1" />
          <Skeleton className="w-10 h-4" />
          <Skeleton className="w-16 h-5 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function RankCardSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-border/50 bg-card">
      <div className="flex items-center gap-3">
        <Skeleton className="w-11 h-11 rounded-xl" />
        <div>
          <Skeleton className="w-40 h-5 mb-2" />
          <Skeleton className="w-56 h-4" />
        </div>
      </div>
      <Skeleton className="w-28 h-8" />
    </div>
  )
}

// ── Tier / Helpers ───────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-800 border-amber-300',
  silver: 'bg-gray-100 text-gray-700 border-gray-300',
  gold: 'bg-yellow-100 text-yellow-800 border-yellow-400',
  diamond: 'bg-blue-100 text-blue-700 border-blue-400',
}

const TIER_THRESHOLDS = [
  { name: 'Bronze', threshold: 0 },
  { name: 'Silver', threshold: 2500 },
  { name: 'Gold', threshold: 10000 },
  { name: 'Diamond', threshold: 50000 },
]

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
  const endDate = new Date(epoch.end + 'T23:59:59Z')
  const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86400000))
  return { ...epoch, number: idx + 1, daysLeft }
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${TIER_COLORS[tier] || TIER_COLORS.bronze}`}>
      {tier}
    </span>
  )
}

const truncAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`

/** ENS-aware address display for use inside .map() loops */
function WalletName({ address }: { address: string }) {
  const { displayName, isEns } = useDisplayName(address)
  return <span className={`text-sm truncate ${isEns ? 'font-medium' : 'font-mono'}`}>{displayName}</span>
}
const fmtVol = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`
const fmtPts = (p: number) => p >= 10000 ? `${(p / 1000).toFixed(1)}k` : p.toLocaleString()

// ── Page ─────────────────────────────────────────────────────

export function PointsPage() {
  const { address } = useWallet()
  const { signMessageAsync } = useSignMessageCompat()
  const [period, setPeriod] = useState<'all' | 'monthly' | 'weekly'>('all')
  const [page, setPage] = useState(1)
  const [showAllRewards, setShowAllRewards] = useState(false)
  const { data: leaderboard, isLoading: lbLoading } = useLeaderboard(period, page)
  const { data: balance, isLoading: balLoading } = usePointsBalance()
  const { actions } = usePointsActions()
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [trackingAction, setTrackingAction] = useState<string | null>(null)

  useEffect(() => {
    if (!address) return
    fetchReferralInfo(address).then((info) => setReferralCode(info.referral_code)).catch(() => {})
  }, [address])

  // Daily check-in state (awarded on button click, not auto)
  const checkinKey = `points:daily_checkin:${new Date().toISOString().slice(0, 10)}`
  const [checkedIn, setCheckedIn] = useState(() => !!localStorage.getItem(checkinKey))

  const handleTrack = async (actionId: string, externalUrl?: string) => {
    if (externalUrl) window.open(externalUrl, '_blank')
    if (!address || !signMessageAsync) return
    setTrackingAction(actionId)
    try {
      const result = await trackPointsAction(actionId, address, signMessageAsync)
      if (result.success) localStorage.setItem(`points:${actionId}:done`, '1')
    } catch { /* silent */ } finally {
      setTrackingAction(null)
    }
  }

  const copyRef = () => {
    if (!referralCode) return
    navigator.clipboard.writeText(`https://autopayprotocol.com/?ref=${referralCode}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareUrl = () => {
    const ref = referralCode ? `?ref=${referralCode}` : ''
    return `https://x.com/intent/tweet?text=${encodeURIComponent('I use @AutoPayProtocol for crypto subscriptions. Non-custodial, multi-chain.\n\nTry it:')}&url=${encodeURIComponent(`https://autopayprotocol.com/${ref}`)}`
  }

  const nextTier = balance ? TIER_THRESHOLDS.find(t => t.threshold > balance.total_points) : TIER_THRESHOLDS[1]
  const progress = balance && nextTier ? Math.min(100, (balance.total_points / nextTier.threshold) * 100) : 0

  const onChainActions = useMemo(() => actions.filter(a => a.source_type === 'on-chain' || a.source_type === 'derived'), [actions])

  const followDone = !!localStorage.getItem('points:follow_x:done')
  const telegramDone = !!localStorage.getItem('points:join_telegram:done')
  const shareDone = !!localStorage.getItem('points:share_x:done')

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {/* ── Rank Card ── */}
      {balLoading ? (
        <RankCardSkeleton />
      ) : address && balance ? (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card shadow-sm">
          <div className="flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-primary/10 shrink-0">
            <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg sm:text-xl font-bold text-primary">#{balance.rank.all_time}</span>
              <WalletName address={address} />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
              <span className="text-xs sm:text-sm font-semibold">{fmtPts(balance.total_points)} pts</span>
              {balance.total_usdc_volume > 0 && <span className="text-[11px] text-muted-foreground">{fmtVol(balance.total_usdc_volume)}</span>}
              <TierBadge tier={balance.tier} />
              {balance.current_streak >= 3 && (
                <span className="flex items-center gap-0.5 text-[11px] text-orange-500 font-medium">
                  <Flame className="h-3 w-3" />{balance.current_streak}d
                </span>
              )}
            </div>
          </div>
          {nextTier && (
            <div className="text-right shrink-0 hidden sm:block">
              <div className="text-xs text-muted-foreground mb-1">Next: {nextTier.name} at {nextTier.threshold.toLocaleString()}</div>
              <div className="w-24 h-1.5 bg-muted rounded-full ml-auto">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* ── Profile for 50 pts ── */}
      <ProfileCard address={address} signMessageAsync={signMessageAsync} />

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Referral */}
        <button
          onClick={copyRef}
          disabled={!referralCode}
          className="relative p-3 sm:p-4 rounded-xl border-2 border-primary/30 bg-primary/[0.03] hover:bg-primary/[0.06] transition-all text-left group col-span-1 sm:col-span-2"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold">Invite Friends</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Earn <span className="font-semibold text-primary">10 pts per $1</span> when they subscribe
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full group-hover:bg-primary/20 transition-colors">
              {copied ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy Link</>}
            </div>
          </div>
          {referralCode && (
            <div className="mt-2.5 px-2.5 py-1.5 rounded-md bg-muted/50 font-mono text-[11px] text-muted-foreground truncate">
              autopayprotocol.com/?ref={referralCode}
            </div>
          )}
        </button>

        {/* Share on X */}
        <button
          onClick={() => handleTrack('share_x', shareUrl())}
          disabled={trackingAction === 'share_x'}
          className={`p-4 rounded-xl border transition-all text-left hover:border-foreground/20 hover:shadow-sm ${
            shareDone ? 'border-green-200 bg-green-50/50' : 'border-border/60'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-foreground/5">
              <Share2 className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold flex items-center gap-1.5">
                Share on X
                <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">+1 daily</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Tweet with your referral link</div>
            </div>
            {shareDone
              ? <Check className="h-4 w-4 text-green-500 shrink-0" />
              : <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            }
          </div>
        </button>

        {/* Follow + Telegram + Check In */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleTrack('follow_x', 'https://x.com/intent/follow?screen_name=AutoPayProtocol')}
            disabled={followDone || trackingAction === 'follow_x'}
            className={`flex-1 px-3.5 py-2.5 rounded-xl border transition-all text-left hover:border-foreground/20 ${
              followDone ? 'border-green-200 bg-green-50/50' : 'border-border/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              <span className="text-xs font-medium">Follow on X</span>
              <span className="ml-auto text-[10px] text-muted-foreground">+2</span>
              {followDone && <Check className="h-3 w-3 text-green-500" />}
            </div>
          </button>
          <button
            onClick={() => handleTrack('join_telegram', 'https://t.me/autopayprotocol')}
            disabled={telegramDone || trackingAction === 'join_telegram'}
            className={`flex-1 px-3.5 py-2.5 rounded-xl border transition-all text-left hover:border-foreground/20 ${
              telegramDone ? 'border-green-200 bg-green-50/50' : 'border-border/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <Send className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs font-medium">Join Telegram</span>
              <span className="ml-auto text-[10px] text-muted-foreground">+2</span>
              {telegramDone && <Check className="h-3 w-3 text-green-500" />}
            </div>
          </button>
          <button
            onClick={() => {
              handleTrack('daily_checkin')
              setCheckedIn(true)
              localStorage.setItem(checkinKey, '1')
            }}
            disabled={checkedIn || trackingAction === 'daily_checkin'}
            className={`flex-1 px-3.5 py-2.5 rounded-xl border transition-all text-left hover:border-foreground/20 ${
              checkedIn ? 'border-green-200 bg-green-50/50' : 'border-border/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <Flame className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs font-medium">Daily Check-In</span>
              <span className="ml-auto text-[10px] text-muted-foreground">+1</span>
              {checkedIn && <Check className="h-3 w-3 text-green-500" />}
            </div>
          </button>
        </div>
      </div>

      {/* ── Epoch label + Leaderboard controls ── */}
      {(() => {
        const epoch = getCurrentEpoch()
        return epoch ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span className="font-semibold text-foreground">Epoch {epoch.number}: {epoch.name}</span>
            <span>·</span>
            <span>{epoch.daysLeft}d remaining</span>
          </div>
        ) : null
      })()}

      <div className="flex items-center justify-between mt-1">
        {!showAllRewards ? (
          <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
            {(['all', 'monthly', 'weekly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setPage(1) }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === p ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p === 'all' ? 'All Time' : p === 'monthly' ? 'Monthly' : 'Weekly'}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {onChainActions.length} actions earn points automatically
          </span>
        )}
        <button
          onClick={() => setShowAllRewards(!showAllRewards)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAllRewards ? 'Leaderboard' : 'On-Chain Rewards'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllRewards ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* ── Content area (fixed min-height prevents layout shift) ── */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {showAllRewards ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/20 p-px">
              {onChainActions.map((action) => (
                <div key={action.action_id} className="flex items-center justify-between px-4 py-3 bg-card">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{action.display_name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{action.description}</div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className={`text-sm font-bold ${action.points_per_usdc ? 'text-primary' : ''}`}>
                      {action.points_per_usdc ? `${action.points_per_usdc}x/$1` : `+${action.points}`}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {action.frequency === 'once' || action.frequency === 'once_per_policy' ? 'once' : 'each'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          lbLoading ? (
            <LeaderboardSkeleton />
          ) : !leaderboard || leaderboard.leaderboard.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Trophy className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">No one on the board yet</p>
              <p className="text-xs text-muted-foreground">Subscribe to a plan to be the first!</p>
            </div>
          ) : (
            <>
              {/* Two-column leaderboard grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border/10">
                {leaderboard.leaderboard.map((entry) => {
                  const isMe = address?.toLowerCase() === entry.wallet
                  return (
                    <div key={entry.wallet} className={`flex items-center gap-2.5 px-4 py-2.5 bg-card ${isMe ? 'bg-primary/[0.04]' : 'hover:bg-muted/20'} transition-colors`}>
                      <span className={`text-sm font-bold w-5 text-center shrink-0 ${entry.rank <= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                        {entry.rank}
                      </span>
                      <AddressAvatar address={entry.wallet} size={26} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <WalletName address={entry.wallet} />
                          {isMe && <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1 rounded">You</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm font-semibold tabular-nums">{fmtPts(entry.points)}</span>
                        <TierBadge tier={entry.tier} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Footer — Full Leaderboard + Pagination */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-border/30">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                  onClick={() => window.open('/leaderboard', '_blank')}
                >
                  <ExternalLink className="h-3 w-3" /> Full Leaderboard
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-7 w-7 p-0">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {page} / {leaderboard.pagination.total_pages || 1}
                  </span>
                  <Button variant="ghost" size="sm" disabled={!leaderboard.pagination.total_pages || page >= leaderboard.pagination.total_pages} onClick={() => setPage(p => p + 1)} className="h-7 w-7 p-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )
          )}
        </CardContent>
      </Card>

    </div>
  )
}

// ── Profile Card (50 pts for email + optional company/feedback) ──

function ProfileCard({ address, signMessageAsync }: {
  address: string | undefined
  signMessageAsync: ((args: { message: string }) => Promise<`0x${string}`>) | undefined
}) {
  const [done, setDone] = useState(() => !!localStorage.getItem('points:submit_profile:done'))
  const [expanded, setExpanded] = useState(false)
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (done || !address) return null

  const handleSubmit = async () => {
    if (!email.trim() || !signMessageAsync) return
    setSubmitting(true)
    setError(null)

    try {
      const { supabase } = await import('../lib/supabase')
      if (supabase) {
        await supabase.from('waitlist_emails').upsert({
          email: email.trim().toLowerCase(),
          wallet_address: address.toLowerCase(),
          company: company.trim() || null,
          feedback: feedback.trim() || null,
          source: 'points_profile',
        }, { onConflict: 'email' })
      }

      const result = await trackPointsAction('submit_profile', address, signMessageAsync)
      if (result.success || result.error === 'already_earned') {
        localStorage.setItem('points:submit_profile:done', '1')
        setDone(true)
      } else {
        setError(result.error || 'Failed to award points')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <button
      onClick={() => !expanded && setExpanded(true)}
      className={`w-full rounded-xl border-2 border-amber-300/40 bg-gradient-to-r from-amber-50/50 to-yellow-50/30 text-left transition-all ${!expanded ? 'hover:border-amber-400/60 hover:shadow-sm cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between p-3 sm:p-4" onClick={() => expanded && setExpanded(false)}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100/80 shrink-0">
            <Trophy className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <div className="text-sm font-semibold">Complete Your Profile</div>
            <div className="text-xs text-muted-foreground mt-0.5">Share your email to earn points and get updates</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-lg sm:text-xl font-bold text-amber-700">+100</span>
          <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">pts</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder="Email *"
              required
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/40 focus:border-amber-400"
            />
            <input
              type="text"
              value={company}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompany(e.target.value)}
              placeholder="Company (optional)"
              className="sm:w-40 px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/40 focus:border-amber-400"
            />
          </div>
          <textarea
            value={feedback}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFeedback(e.target.value)}
            placeholder="Feedback or what you're building (optional)"
            rows={2}
            className="w-full mt-2 px-3 py-2 rounded-lg border border-border bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300/40 focus:border-amber-400"
          />
          {error && <p className="text-[11px] text-destructive mt-1.5">{error}</p>}
          <Button
            onClick={handleSubmit}
            disabled={submitting || !email.trim()}
            size="sm"
            className="mt-2.5 h-9 text-sm px-6 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Submitting...</> : 'Submit & Earn 100 pts'}
          </Button>
        </div>
      )}
    </button>
  )
}
