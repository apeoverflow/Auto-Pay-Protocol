import { useState } from 'react'
import { Card, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { useMerchantReports, type MerchantReport } from '../../hooks/useMerchantReports'
import { useWallet } from '../../hooks/useWallet'
import { useChain } from '../../hooks/useChain'
import { fetchMerchantReportData, generateMerchantReport, downloadMerchantReportCsv } from '../../lib/relayer'
import { useSignMessage } from 'wagmi'
import { Loader2, ExternalLink, FileText, Eye, Plus, Download, Check, Share2 } from 'lucide-react'

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
          <CardContent className="py-10 flex flex-col items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-semibold">No reports yet</h3>
              <p className="text-xs text-muted-foreground max-w-md">
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
                <tr className="border-b border-border/40">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Period</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">IPFS CID</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Generated</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.period} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatPeriod(report.period)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {report.cid ? (
                        <a
                          href={report.ipfsUrl || `${IPFS_GATEWAY}/${report.cid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline font-mono"
                        >
                          {report.cid.slice(0, 12)}...
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Local only</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(report.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
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
                              <Check className="h-3 w-3 text-green-600" />
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

      {/* Report detail view */}
      {viewedReport && (
        <Card>
          <CardContent className="py-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {formatPeriod(viewedReport.period)} Report
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setViewedReport(null)}
              >
                Close
              </Button>
            </div>

            {/* Revenue */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Revenue</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                  <p className="text-sm font-semibold tabular-nums">${formatAmount(viewedReport.data.revenue.totalRevenue)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Protocol Fees</p>
                  <p className="text-sm font-semibold tabular-nums">${formatAmount(viewedReport.data.revenue.protocolFees)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Net Revenue</p>
                  <p className="text-sm font-semibold tabular-nums text-green-600">${formatAmount(viewedReport.data.revenue.netRevenue)}</p>
                </div>
              </div>
            </div>

            {/* Charges */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Charges</h4>
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-sm font-semibold tabular-nums">{viewedReport.data.charges.total}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Successful</p>
                  <p className="text-sm font-semibold tabular-nums text-green-600">{viewedReport.data.charges.successful}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Failed</p>
                  <p className="text-sm font-semibold tabular-nums text-red-500">{viewedReport.data.charges.failed}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Failure Rate</p>
                  <p className="text-sm font-semibold tabular-nums">{(viewedReport.data.charges.failureRate * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* Subscribers */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Subscribers</h4>
              <div className="grid grid-cols-5 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-sm font-semibold tabular-nums">{viewedReport.data.subscribers.active}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">New</p>
                  <p className="text-sm font-semibold tabular-nums text-green-600">{viewedReport.data.subscribers.new}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Cancelled</p>
                  <p className="text-sm font-semibold tabular-nums">{viewedReport.data.subscribers.cancelled}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Failed Cancel</p>
                  <p className="text-sm font-semibold tabular-nums">{viewedReport.data.subscribers.cancelledByFailure}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Churn Rate</p>
                  <p className="text-sm font-semibold tabular-nums">{(viewedReport.data.subscribers.churnRate * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* Top Plans */}
            {viewedReport.data.topPlans.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Top Plans</h4>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Plan</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Subscribers</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewedReport.data.topPlans.map((plan, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-2 font-mono">{plan.planId || 'N/A'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{plan.subscribers}</td>
                          <td className="px-3 py-2 text-right tabular-nums">${formatAmount(plan.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Receipts count */}
            {viewedReport.data.chargeReceipts.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {viewedReport.data.chargeReceipts.length} charge receipt CID{viewedReport.data.chargeReceipts.length !== 1 ? 's' : ''} included in this report
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
