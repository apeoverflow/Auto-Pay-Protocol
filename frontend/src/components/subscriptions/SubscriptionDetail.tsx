import { useState } from 'react'
import { formatUnits } from 'viem'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '../ui/drawer'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '../ui/dialog'
import { formatUSDC, formatInterval } from '../../types/subscriptions'
import type { OnChainPolicy } from '../../types/policy'
import type { PolicyMetadata } from '../../hooks'
import { useChain } from '../../hooks'
import { USDC_DECIMALS } from '../../config'
import {
  Clock,
  ExternalLink,
  Globe,
  Mail,
  Shield,
  FileText,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react'

interface SubscriptionDetailProps {
  policy: OnChainPolicy
  metadata?: PolicyMetadata | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCancel?: (policyId: `0x${string}`) => void
  isCancelling?: boolean
}

function getMerchantTheme(address: string) {
  const themes = [
    { gradient: 'from-blue-500 to-indigo-500' },
    { gradient: 'from-emerald-500 to-teal-500' },
    { gradient: 'from-violet-500 to-purple-500' },
    { gradient: 'from-orange-500 to-amber-500' },
    { gradient: 'from-pink-500 to-rose-500' },
    { gradient: 'from-cyan-500 to-blue-500' },
  ]
  const index = parseInt(address.slice(-2), 16) % themes.length
  return themes[index]
}

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function getRemainingTime(nextChargeTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = nextChargeTimestamp - now
  if (diff < 0) return 'Overdue'
  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const mins = Math.floor((diff % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  if (mins > 0) return `~${mins} min${mins !== 1 ? 's' : ''}`
  return '<1 min'
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-medium text-foreground text-right">{children}</span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em] mb-2.5">{children}</p>
  )
}

function LinkPill({ href, icon: Icon, children, mail }: { href: string; icon: React.ElementType; children: React.ReactNode; mail?: boolean }) {
  return (
    <a
      href={mail ? `mailto:${href}` : href}
      target={mail ? undefined : '_blank'}
      rel={mail ? undefined : 'noopener noreferrer'}
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-full border border-border/50 hover:border-border hover:bg-muted/30 transition-all"
    >
      <Icon className="h-3 w-3" />
      {children}
    </a>
  )
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : false
  )
  useState(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  })
  return isDesktop
}

function DetailContent({
  policy,
  metadata,
  onCancel,
  isCancelling,
  isDesktop,
}: {
  policy: OnChainPolicy
  metadata?: PolicyMetadata | null
  onCancel?: (policyId: `0x${string}`) => void
  isCancelling?: boolean
  isDesktop: boolean
}) {
  const { chainConfig } = useChain()
  const theme = getMerchantTheme(policy.merchant)
  const [logoFailed, setLogoFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  const displayName = metadata?.merchant?.name || formatAddress(policy.merchant)
  const planName = metadata?.plan?.name
  const planDescription = metadata?.plan?.description
  const merchantLogo = !logoFailed ? metadata?.merchant?.logo : undefined
  const avatarLetters = metadata?.merchant?.name
    ? metadata.merchant.name.slice(0, 2).toUpperCase()
    : policy.merchant.slice(2, 4).toUpperCase()
  const features = metadata?.plan?.features
  const accentColor = metadata?.display?.color

  const status = policy.active ? 'active' : 'cancelled'
  const nextChargeTime = policy.lastCharged + policy.interval
  const merchantExplorerUrl = `${chainConfig.explorer}/address/${policy.merchant}`
  const policyExplorerUrl = `${chainConfig.explorer}/address/${chainConfig.policyManager}`

  const spentPercent = policy.spendingCap > 0n
    ? Math.min(100, Math.round(Number(policy.totalSpent * 100n / policy.spendingCap)))
    : 0

  const copyPolicyId = () => {
    navigator.clipboard.writeText(policy.policyId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const Title = isDesktop ? DialogTitle : DrawerTitle
  const Description = isDesktop ? DialogDescription : DrawerDescription
  const Close = isDesktop ? DialogClose : DrawerClose

  return (
    <>
      {/* ── Header zone ── */}
      <div className="px-6 pt-6 pb-4 border-b border-border/40 bg-muted/[0.03]">
        <div className="flex items-start gap-4">
          {merchantLogo ? (
            <img
              src={merchantLogo}
              alt={displayName}
              onError={() => setLogoFailed(true)}
              className="h-14 w-14 flex-shrink-0 rounded-2xl object-cover shadow-md ring-1 ring-black/5"
            />
          ) : (
            <div
              className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-white text-lg font-bold shadow-md ring-1 ring-black/5 bg-gradient-to-br ${theme.gradient}`}
              style={accentColor ? { background: accentColor } : undefined}
            >
              {avatarLetters}
            </div>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-2.5 mb-1">
              <Title className="text-[17px] font-semibold truncate leading-tight">{displayName}</Title>
              <Badge
                variant={status === 'active' ? 'success' : 'secondary'}
                className="text-[10px] px-2 py-0.5 font-medium flex-shrink-0"
              >
                {status === 'active' ? 'Active' : 'Cancelled'}
              </Badge>
            </div>
            <Description className="text-[13px] text-muted-foreground">
              {planName || formatAddress(policy.merchant)}
            </Description>
            {planDescription && (
              <p className="text-[12px] text-muted-foreground/70 leading-relaxed mt-1.5 line-clamp-2">{planDescription}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="overflow-y-auto overscroll-contain max-h-[50vh] md:max-h-[45vh]">
        <div className="px-6 py-5 space-y-5">

          {/* ── Billing summary ── */}
          <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-muted/30 to-transparent p-5">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[28px] font-bold tracking-tight leading-none" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {formatUSDC(policy.chargeAmount)}
              </span>
              <span className="text-[13px] text-muted-foreground font-medium">
                {formatInterval(policy.interval).toLowerCase()}
              </span>
            </div>
            {policy.active && (
              <div className="flex items-center gap-1.5 mt-2.5 text-[12px] text-muted-foreground/80">
                <Clock className="h-3.5 w-3.5" />
                <span>Next charge in <span className="font-medium text-foreground/70">{getRemainingTime(nextChargeTime)}</span></span>
              </div>
            )}
          </div>

          {/* ── Features ── */}
          {features && features.length > 0 && (
            <div>
              <SectionLabel>Includes</SectionLabel>
              <div className="grid gap-2">
                {features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-[13px]">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 flex-shrink-0">
                      <Check className="h-3 w-3 text-emerald-500" />
                    </div>
                    <span className="text-foreground/80">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Details ── */}
          <div>
            <SectionLabel>Details</SectionLabel>
            <div className="rounded-xl border border-border/30 px-4">
              <DetailRow label="Charges">{policy.chargeCount} completed</DetailRow>
              <DetailRow label="Total spent">{formatUnits(policy.totalSpent, USDC_DECIMALS)} USDC</DetailRow>
              <DetailRow label="Spending cap">
                <div className="flex items-center gap-2.5">
                  <span>{formatUnits(policy.spendingCap, USDC_DECIMALS)} USDC</span>
                  <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${spentPercent}%` }} />
                  </div>
                </div>
              </DetailRow>
              <DetailRow label="Interval">{formatInterval(policy.interval)}</DetailRow>
              {policy.consecutiveFailures > 0 && (
                <DetailRow label="Failed charges">
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    {policy.consecutiveFailures} consecutive
                  </span>
                </DetailRow>
              )}
              <DetailRow label="Policy ID">
                <button onClick={copyPolicyId} className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  {policy.policyId.slice(0, 10)}...{policy.policyId.slice(-6)}
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                </button>
              </DetailRow>
            </div>
          </div>

          {/* ── Links ── */}
          <div>
            <SectionLabel>Links</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {metadata?.merchant?.website && <LinkPill href={metadata.merchant.website} icon={Globe}>Website</LinkPill>}
              {metadata?.merchant?.supportEmail && <LinkPill href={metadata.merchant.supportEmail} icon={Mail} mail>Support</LinkPill>}
              {metadata?.merchant?.termsUrl && <LinkPill href={metadata.merchant.termsUrl} icon={FileText}>Terms</LinkPill>}
              {metadata?.merchant?.privacyUrl && <LinkPill href={metadata.merchant.privacyUrl} icon={Shield}>Privacy</LinkPill>}
              <LinkPill href={merchantExplorerUrl} icon={ExternalLink}>Explorer</LinkPill>
              <LinkPill href={policyExplorerUrl} icon={ExternalLink}>Contract</LinkPill>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-border/40 px-6 py-4">
        {policy.active && onCancel ? (
          <div className="flex gap-3">
            <Close asChild>
              <Button variant="outline" className="flex-1 h-10">Close</Button>
            </Close>
            <Button
              variant="destructive"
              className="flex-1 h-10"
              onClick={() => onCancel(policy.policyId)}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cancelling...</>
              ) : (
                'Cancel Subscription'
              )}
            </Button>
          </div>
        ) : (
          <Close asChild>
            <Button variant="outline" className="w-full h-10">Close</Button>
          </Close>
        )}
      </div>
    </>
  )
}

export function SubscriptionDetail({
  policy,
  metadata,
  open,
  onOpenChange,
  onCancel,
  isCancelling,
}: SubscriptionDetailProps) {
  const isDesktop = useIsDesktop()

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="p-0 gap-0 overflow-hidden max-w-[440px]">
          <DetailContent
            policy={policy}
            metadata={metadata}
            onCancel={onCancel}
            isCancelling={isCancelling}
            isDesktop
          />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DetailContent
          policy={policy}
          metadata={metadata}
          onCancel={onCancel}
          isCancelling={isCancelling}
          isDesktop={false}
        />
      </DrawerContent>
    </Drawer>
  )
}
