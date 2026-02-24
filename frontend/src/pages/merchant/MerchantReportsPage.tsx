import { useState } from 'react'
import { Card, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { useMerchantReports, type MerchantReport } from '../../hooks/useMerchantReports'
import { useWallet } from '../../hooks/useWallet'
import { deriveReportKey, decryptReport } from '../../lib/decrypt-report'
import { registerMerchantEncryptionKey } from '../../lib/relayer'
import { useSignMessage } from 'wagmi'
import { Loader2, ExternalLink, Lock, ShieldCheck, FileText, Eye } from 'lucide-react'

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
  const { signMessageAsync } = useSignMessage()
  const [decryptedReport, setDecryptedReport] = useState<{ period: string; data: ReportData } | null>(null)
  const [decrypting, setDecrypting] = useState<string | null>(null)
  const [decryptError, setDecryptError] = useState<string | null>(null)
  const [settingUpKey, setSettingUpKey] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [setupDone, setSetupDone] = useState(false)

  const handleSetupEncryption = async () => {
    if (!address) return
    setSettingUpKey(true)
    setSetupError(null)
    try {
      // Step 1: Derive key from wallet signature
      const keyHex = await deriveReportKey(signMessageAsync, address)
      // Step 2: Register key with relayer (handles auth internally)
      await registerMerchantEncryptionKey(address, keyHex, signMessageAsync)
      setSetupDone(true)
      refetch()
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Failed to set up encryption')
    } finally {
      setSettingUpKey(false)
    }
  }

  const handleDecrypt = async (report: MerchantReport) => {
    if (!address) return
    setDecrypting(report.period)
    setDecryptError(null)
    setDecryptedReport(null)
    try {
      // Step 1: Derive key
      const keyHex = await deriveReportKey(signMessageAsync, address)
      // Step 2: Fetch encrypted blob from IPFS
      const res = await fetch(`${IPFS_GATEWAY}/${report.cid}`)
      if (!res.ok) throw new Error('Failed to fetch report from IPFS')
      const blob = await res.arrayBuffer()
      // Step 3: Decrypt
      const data = await decryptReport(blob, keyHex)
      setDecryptedReport({ period: report.period, data: data as ReportData })
    } catch (err) {
      setDecryptError(err instanceof Error ? err.message : 'Failed to decrypt report')
    } finally {
      setDecrypting(null)
    }
  }

  // Show setup card if no reports and no loading error (likely no key registered)
  const showSetup = !isLoading && reports.length === 0 && !setupDone

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Monthly Reports</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Encrypted business intelligence stored on Filecoin
          </p>
        </div>
        {reports.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {reports.length} report{reports.length !== 1 ? 's' : ''}
          </span>
        )}
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

      {/* Setup Encryption Card */}
      {showSetup && (
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-semibold">Set Up Encrypted Reports</h3>
              <p className="text-xs text-muted-foreground max-w-md">
                Sign a message with your wallet to derive an encryption key. Monthly reports will be encrypted
                with this key and stored on Filecoin. Only you can decrypt them.
              </p>
            </div>
            {setupError && (
              <p className="text-xs text-destructive">{setupError}</p>
            )}
            <Button onClick={handleSetupEncryption} disabled={settingUpKey} size="sm">
              {settingUpKey ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Setting up...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Set Up Encryption Key
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Setup success */}
      {setupDone && reports.length === 0 && (
        <Card>
          <CardContent className="py-8 flex flex-col items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-green-500" />
            <div className="text-center space-y-1">
              <h3 className="text-sm font-semibold">Encryption Key Registered</h3>
              <p className="text-xs text-muted-foreground">
                Your reports will be generated at the end of each month and will appear here.
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
                      <a
                        href={`${IPFS_GATEWAY}/${report.cid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline font-mono"
                      >
                        {report.cid.slice(0, 12)}...
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(report.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleDecrypt(report)}
                        disabled={decrypting === report.period}
                      >
                        {decrypting === report.period ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                        Decrypt & View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Decrypt error */}
      {decryptError && (
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-sm text-destructive">{decryptError}</p>
          </CardContent>
        </Card>
      )}

      {/* Decrypted report view */}
      {decryptedReport && (
        <Card>
          <CardContent className="py-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {formatPeriod(decryptedReport.period)} Report
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setDecryptedReport(null)}
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
                  <p className="text-sm font-semibold tabular-nums">${formatAmount(decryptedReport.data.revenue.totalRevenue)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Protocol Fees</p>
                  <p className="text-sm font-semibold tabular-nums">${formatAmount(decryptedReport.data.revenue.protocolFees)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Net Revenue</p>
                  <p className="text-sm font-semibold tabular-nums text-green-600">${formatAmount(decryptedReport.data.revenue.netRevenue)}</p>
                </div>
              </div>
            </div>

            {/* Charges */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Charges</h4>
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-sm font-semibold tabular-nums">{decryptedReport.data.charges.total}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Successful</p>
                  <p className="text-sm font-semibold tabular-nums text-green-600">{decryptedReport.data.charges.successful}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Failed</p>
                  <p className="text-sm font-semibold tabular-nums text-red-500">{decryptedReport.data.charges.failed}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Failure Rate</p>
                  <p className="text-sm font-semibold tabular-nums">{(decryptedReport.data.charges.failureRate * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* Subscribers */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Subscribers</h4>
              <div className="grid grid-cols-5 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-sm font-semibold tabular-nums">{decryptedReport.data.subscribers.active}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">New</p>
                  <p className="text-sm font-semibold tabular-nums text-green-600">{decryptedReport.data.subscribers.new}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Cancelled</p>
                  <p className="text-sm font-semibold tabular-nums">{decryptedReport.data.subscribers.cancelled}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Failed Cancel</p>
                  <p className="text-sm font-semibold tabular-nums">{decryptedReport.data.subscribers.cancelledByFailure}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Churn Rate</p>
                  <p className="text-sm font-semibold tabular-nums">{(decryptedReport.data.subscribers.churnRate * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* Top Plans */}
            {decryptedReport.data.topPlans.length > 0 && (
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
                      {decryptedReport.data.topPlans.map((plan, i) => (
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
            {decryptedReport.data.chargeReceipts.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {decryptedReport.data.chargeReceipts.length} charge receipt CID{decryptedReport.data.chargeReceipts.length !== 1 ? 's' : ''} included in this report
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
