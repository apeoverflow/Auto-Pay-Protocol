import { useState } from 'react'
import { Card, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { useMerchantReports, type MerchantReport } from '../../hooks/useMerchantReports'
import { useWallet } from '../../hooks/useWallet'
import { useChain } from '../../hooks/useChain'
import { fetchMerchantReportData, generateMerchantReport, downloadMerchantReportCsv } from '../../lib/relayer'
import { useSignMessage } from 'wagmi'
import {
  Loader2, ExternalLink, FileText, Eye, Plus, Download, Check, Share2,
  DollarSign, TrendingUp, Users, Zap, ArrowUpRight, ArrowDownRight, X,
  BarChart3, ChevronRight,
} from 'lucide-react'

const IPFS_GATEWAY = 'https://w3s.link/ipfs'

function formatPeriod(period: string): string {
  const [year, month] = period.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatAmount(amountRaw: string): string {
  const num = Number(amountRaw) / 1e6
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface ReportData {
  revenue: { totalRevenue: string; protocolFees: string; netRevenue: string }
  charges: { total: number; successful: number; failed: number; failureRate: number }
  subscribers: { active: number; new: number; cancelled: number; cancelledByFailure: number; churnRate: number }
  topPlans: Array<{ planId: string | null; subscribers: number; revenue: string }>
  chargeReceipts: string[]
}

// --- Stat card component ---
function Stat({ label, value, sub, tint, icon: Icon }: {
  label: string
  value: string | number
  sub?: string
  tint?: 'green' | 'red' | 'blue' | 'amber' | 'default'
  icon?: React.ElementType
}) {
  const tintClasses: Record<string, string> = {
    green: 'bg-emerald-500/8 border-emerald-500/20 dark:bg-emerald-500/10 dark:border-emerald-400/15',
    red: 'bg-red-500/8 border-red-500/20 dark:bg-red-500/10 dark:border-red-400/15',
    blue: 'bg-blue-500/8 border-blue-500/20 dark:bg-blue-500/10 dark:border-blue-400/15',
    amber: 'bg-amber-500/8 border-amber-500/20 dark:bg-amber-500/10 dark:border-amber-400/15',
    default: 'bg-muted/50 border-border/60',
  }
  const valueClasses: Record<string, string> = {
    green: 'text-emerald-700 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    blue: 'text-blue-700 dark:text-blue-400',
    amber: 'text-amber-700 dark:text-amber-400',
    default: 'text-foreground',
  }
  const t = tint || 'default'
  return (
    <div className={`rounded-lg border p-3.5 transition-colors ${tintClasses[t]}`}>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />}
      </div>
      <p className={`text-lg font-semibold tabular-nums leading-none ${valueClasses[t]}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

export function MerchantReportsPage() {
  const { reports, isLoading, error, refetch } = useMerchantReports()
  const { address } = useWallet()
  const { chainConfig } = useChain()
  const { signMessageAsync } = useSignMessage()
  const [viewedReport, setViewedReport] = useState<{ period: string; data: ReportData } | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [viewError, setViewError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [uploadToIpfs, setUploadToIpfs] = useState(true)
  const [copiedCid, setCopiedCid] = useState<string | null>(null)

  const handleCopyLink = (report: MerchantReport) => {
    const url = report.ipfsUrl || `${IPFS_GATEWAY}/${report.cid}`
    navigator.clipboard.writeText(url)
    setCopiedCid(report.cid)
    setTimeout(() => setCopiedCid(null), 2000)
  }

  const handleGenerate = async () => {
    if (!address) return
    setGenerating(true)
    setGenerateError(null)
    try {
      await generateMerchantReport(address, chainConfig.chain.id, signMessageAsync, undefined, uploadToIpfs)
      refetch()
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  const handleView = async (report: MerchantReport) => {
    if (!address) return
    setViewing(report.period)
    setViewError(null)
    setViewedReport(null)
    try {
      const data = await fetchMerchantReportData(address, chainConfig.chain.id, report.period, signMessageAsync)
      setViewedReport({ period: report.period, data: data as ReportData })
    } catch (err) {
      setViewError(err instanceof Error ? err.message : 'Failed to fetch report')
    } finally {
      setViewing(null)
    }
  }

  const handleDownloadCsv = async (report: MerchantReport) => {
    if (!address) return
    setDownloading(report.period)
    setDownloadError(null)
    try {
      await downloadMerchantReportCsv(address, chainConfig.chain.id, report.period, signMessageAsync)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Failed to download CSV')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Monthly Reports</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Transparent reports for your community, optionally archived on Filecoin
          </p>
        </div>
        <div className="flex items-center gap-3">
          {reports.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {reports.length} report{reports.length !== 1 ? 's' : ''}
            </span>
          )}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={uploadToIpfs}
              onChange={(e) => setUploadToIpfs(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
            Archive on Filecoin
          </label>
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Generate Report
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error loading reports */}
      {error && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generate error */}
      {generateError && (
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-sm text-destructive">{generateError}</p>
          </CardContent>
        </Card>
      )}

      {/* Download error */}
      {downloadError && (
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-sm text-destructive">{downloadError}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !error && reports.length === 0 && (
        <Card>
          <CardContent className="py-14 flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 border border-primary/15">
              <BarChart3 className="h-7 w-7 text-primary" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-sm font-semibold">No reports yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                Generate your first transparency report. Share it with your community to show where funds are going.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports list */}
      {!isLoading && reports.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Period</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">IPFS CID</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Generated</th>
                  <th className="text-right px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr
                    key={report.period}
                    className="border-b border-border/20 last:border-0 hover:bg-muted/40 transition-colors group"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/8 border border-primary/15 shrink-0">
                          <FileText className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="text-xs font-medium">{formatPeriod(report.period)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      {report.cid ? (
                        <a
                          href={report.ipfsUrl || `${IPFS_GATEWAY}/${report.cid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-primary hover:underline font-mono text-[11px] bg-primary/5 border border-primary/10 rounded-md px-2 py-0.5"
                        >
                          {report.cid.slice(0, 14)}...
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : (
                        <span className="inline-flex items-center text-[11px] text-muted-foreground bg-muted/60 rounded-md px-2 py-0.5">
                          Local only
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(report.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => handleView(report)}
                          disabled={viewing === report.period}
                        >
                          {viewing === report.period ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => handleDownloadCsv(report)}
                          disabled={downloading === report.period}
                        >
                          {downloading === report.period ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3" />
                          )}
                          CSV
                        </Button>
                        {report.cid && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleCopyLink(report)}
                          >
                            {copiedCid === report.cid ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Share2 className="h-3 w-3" />
                            )}
                            {copiedCid === report.cid ? 'Copied' : 'Share'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* View error */}
      {viewError && (
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-sm text-destructive">{viewError}</p>
          </CardContent>
        </Card>
      )}

      {/* ===== Report detail view ===== */}
      {viewedReport && (
        <div className="flex flex-col gap-4">
          {/* Detail header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/15">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold leading-none">
                  {formatPeriod(viewedReport.period)}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Monthly Report</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setViewedReport(null)}
            >
              <X className="h-3 w-3" />
              Close
            </Button>
          </div>

          {/* Hero: Net Revenue */}
          <Card className="overflow-hidden">
            <div className="relative">
              {/* Subtle gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5 dark:from-emerald-500/8 dark:to-blue-500/8" />
              <CardContent className="relative py-6">
                <div className="grid grid-cols-3 gap-6 items-end">
                  {/* Net Revenue - hero */}
                  <div className="col-span-1">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/15">
                        <DollarSign className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Net Revenue</p>
                    </div>
                    <p className="text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400 tracking-tight">
                      ${formatAmount(viewedReport.data.revenue.netRevenue)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">After 2.5% protocol fee</p>
                  </div>
                  {/* Gross + Fees */}
                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-border/50 bg-card/80 p-3.5">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Gross Revenue</p>
                        <TrendingUp className="h-3 w-3 text-muted-foreground/50" />
                      </div>
                      <p className="text-base font-semibold tabular-nums">${formatAmount(viewedReport.data.revenue.totalRevenue)}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-card/80 p-3.5">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Protocol Fees</p>
                        <DollarSign className="h-3 w-3 text-muted-foreground/50" />
                      </div>
                      <p className="text-base font-semibold tabular-nums text-muted-foreground">${formatAmount(viewedReport.data.revenue.protocolFees)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </div>
          </Card>

          {/* Charges + Subscribers side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Charges */}
            <Card>
              <CardContent className="py-5">
                <div className="flex items-center gap-1.5 mb-4">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500/15">
                    <Zap className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Charges</p>
                </div>

                {/* Success rate bar */}
                <div className="mb-4">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-2xl font-bold tabular-nums tracking-tight">
                      {viewedReport.data.charges.total > 0
                        ? ((1 - viewedReport.data.charges.failureRate) * 100).toFixed(1)
                        : '0.0'}%
                    </span>
                    <span className="text-[11px] text-muted-foreground">success rate</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-500"
                      style={{
                        width: `${viewedReport.data.charges.total > 0
                          ? (1 - viewedReport.data.charges.failureRate) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md bg-muted/50 px-2.5 py-2 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
                    <p className="text-sm font-semibold tabular-nums mt-0.5">{viewedReport.data.charges.total}</p>
                  </div>
                  <div className="rounded-md bg-emerald-500/8 px-2.5 py-2 text-center">
                    <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70 uppercase tracking-wide">Passed</p>
                    <p className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">{viewedReport.data.charges.successful}</p>
                  </div>
                  <div className="rounded-md bg-red-500/8 px-2.5 py-2 text-center">
                    <p className="text-[10px] text-red-600/70 dark:text-red-400/70 uppercase tracking-wide">Failed</p>
                    <p className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400 mt-0.5">{viewedReport.data.charges.failed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Subscribers */}
            <Card>
              <CardContent className="py-5">
                <div className="flex items-center gap-1.5 mb-4">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/15">
                    <Users className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Subscribers</p>
                </div>

                {/* Active count hero */}
                <div className="mb-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums tracking-tight">{viewedReport.data.subscribers.active}</span>
                    <span className="text-[11px] text-muted-foreground">active</span>
                  </div>
                  {viewedReport.data.subscribers.churnRate > 0 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                      {(viewedReport.data.subscribers.churnRate * 100).toFixed(1)}% churn
                    </p>
                  )}
                  {viewedReport.data.subscribers.churnRate === 0 && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                      0% churn
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 rounded-md bg-emerald-500/8 px-2.5 py-2">
                    <ArrowUpRight className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70 uppercase tracking-wide">New</p>
                      <p className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{viewedReport.data.subscribers.new}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-2">
                    <ArrowDownRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cancelled</p>
                      <p className="text-sm font-semibold tabular-nums">{viewedReport.data.subscribers.cancelled}</p>
                    </div>
                  </div>
                  {viewedReport.data.subscribers.cancelledByFailure > 0 && (
                    <div className="col-span-2 flex items-center gap-2 rounded-md bg-red-500/8 px-2.5 py-2">
                      <X className="h-3 w-3 text-red-600 dark:text-red-400 shrink-0" />
                      <div>
                        <p className="text-[10px] text-red-600/70 dark:text-red-400/70 uppercase tracking-wide">Failed Cancellations</p>
                        <p className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">{viewedReport.data.subscribers.cancelledByFailure}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Plans */}
          {viewedReport.data.topPlans.length > 0 && (
            <Card>
              <CardContent className="py-5">
                <div className="flex items-center gap-1.5 mb-4">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/15">
                    <BarChart3 className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Top Plans</p>
                </div>

                <div className="space-y-1.5">
                  {viewedReport.data.topPlans.map((plan, i) => {
                    const maxRevenue = Math.max(...viewedReport.data.topPlans.map(p => Number(p.revenue)))
                    const pct = maxRevenue > 0 ? (Number(plan.revenue) / maxRevenue) * 100 : 0
                    return (
                      <div key={i} className="group relative rounded-lg border border-border/40 hover:border-border/80 transition-colors overflow-hidden">
                        {/* Revenue proportion bar */}
                        <div
                          className="absolute inset-y-0 left-0 bg-primary/5 dark:bg-primary/8 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                        <div className="relative flex items-center justify-between px-3.5 py-2.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/80 text-[10px] font-bold text-muted-foreground tabular-nums">
                              {i + 1}
                            </div>
                            <span className="text-xs font-mono font-medium">{plan.planId || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Subs</p>
                              <p className="text-xs font-semibold tabular-nums">{plan.subscribers}</p>
                            </div>
                            <div className="text-right min-w-[70px]">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Revenue</p>
                              <p className="text-xs font-semibold tabular-nums">${formatAmount(plan.revenue)}</p>
                            </div>
                            <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Receipts footer */}
          {viewedReport.data.chargeReceipts.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <div className="h-px flex-1 bg-border/40" />
              <p className="text-[11px] text-muted-foreground shrink-0">
                {viewedReport.data.chargeReceipts.length} charge receipt{viewedReport.data.chargeReceipts.length !== 1 ? 's' : ''} on Filecoin
              </p>
              <div className="h-px flex-1 bg-border/40" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
