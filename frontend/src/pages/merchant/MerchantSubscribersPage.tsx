import * as React from 'react'
import { Card, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { useMerchantSubscribers } from '../../hooks/useMerchantSubscribers'
import { useMerchantPlans } from '../../hooks/useMerchantPlans'
import { Loader2, Download, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react'

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function formatInterval(seconds: number): string {
  if (seconds >= 31536000) return 'yearly'
  if (seconds >= 7776000) return 'quarterly'
  if (seconds >= 2592000) return 'monthly'
  if (seconds >= 1209600) return 'biweekly'
  if (seconds >= 604800) return 'weekly'
  if (seconds >= 86400) return 'daily'
  return `${seconds}s`
}

function formatUSD(amount: string) {
  const num = parseFloat(amount) / 1e6
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function MerchantSubscribersPage() {
  const [planFilter, setPlanFilter] = React.useState<string | undefined>(undefined)
  const { subscribers, total, isLoading, error, page, setPage, refetch } = useMerchantSubscribers(planFilter)
  const { plans } = useMerchantPlans('active')
  const [copiedAddr, setCopiedAddr] = React.useState<string | null>(null)
  const [expandedRow, setExpandedRow] = React.useState<string | null>(null)

  const handleCopyAddress = async (addr: string) => {
    await navigator.clipboard.writeText(addr)
    setCopiedAddr(addr)
    setTimeout(() => setCopiedAddr(null), 2000)
  }

  const handleExportCsv = () => {
    if (subscribers.length === 0) return

    // Collect all unique form data keys
    const allKeys = new Set<string>()
    for (const sub of subscribers) {
      for (const key of Object.keys(sub.formData)) allKeys.add(key)
    }
    const formKeys = Array.from(allKeys).sort()

    const headers = ['Wallet', 'Plan', ...formKeys, 'Amount (USDC)', 'Interval', 'Status', 'Subscribed']
    const rows = subscribers.map((sub) => [
      sub.payer,
      sub.planId || '-',
      ...formKeys.map((k) => sub.formData[k] || ''),
      formatUSD(sub.chargeAmount),
      formatInterval(sub.intervalSeconds),
      sub.active ? 'Active' : 'Cancelled',
      new Date(sub.createdAt).toLocaleDateString(),
    ])

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {/* Plan filter */}
          <select
            value={planFilter || ''}
            onChange={(e) => { setPlanFilter(e.target.value || undefined); setPage(1) }}
            className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
          >
            <option value="">All Plans</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.planName || p.id}</option>
            ))}
          </select>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={subscribers.length === 0}
          onClick={handleExportCsv}
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!isLoading && !error && subscribers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm text-muted-foreground">
              No subscribers yet
            </p>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!isLoading && !error && subscribers.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Wallet</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Plan</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Info</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Amount</th>
                  <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((sub) => {
                  const formEntries = Object.entries(sub.formData)
                  const isExpanded = expandedRow === sub.policyId
                  return (
                    <React.Fragment key={sub.policyId}>
                      <tr
                        className="border-b border-border/20 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setExpandedRow(isExpanded ? null : sub.policyId)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs">{truncateAddress(sub.payer)}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopyAddress(sub.payer) }}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy address"
                            >
                              {copiedAddr === sub.payer
                                ? <Check className="h-3 w-3 text-green-500" />
                                : <Copy className="h-3 w-3" />
                              }
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {sub.planId || '-'}
                        </td>
                        <td className="px-4 py-3">
                          {formEntries.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {formEntries.slice(0, 2).map(([key, val]) => (
                                <span key={key} className="text-xs bg-muted px-1.5 py-0.5 rounded" title={`${key}: ${val}`}>
                                  {val.length > 20 ? val.slice(0, 20) + '...' : val}
                                </span>
                              ))}
                              {formEntries.length > 2 && (
                                <span className="text-xs text-muted-foreground">+{formEntries.length - 2}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs">
                          ${formatUSD(sub.chargeAmount)}/{formatInterval(sub.intervalSeconds)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {sub.active
                            ? <Badge variant="success" className="text-[10px]">Active</Badge>
                            : <Badge variant="secondary" className="text-[10px]">Cancelled</Badge>
                          }
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          {new Date(sub.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                      {isExpanded && formEntries.length > 0 && (
                        <tr className="bg-muted/20">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                              {formEntries.map(([key, val]) => (
                                <div key={key}>
                                  <span className="font-medium text-muted-foreground capitalize">{key}: </span>
                                  <span>{val}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
              <p className="text-xs text-muted-foreground">
                {total} subscriber{total !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
