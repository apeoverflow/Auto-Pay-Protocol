import { Card, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { useMerchantCharges } from '../../hooks/useMerchantCharges'
import { useChain } from '../../hooks/useChain'
import { Loader2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'

const IPFS_GATEWAY = 'https://w3s.link/ipfs'
const PAGE_SIZE = 20

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function formatAmount(amountRaw: string): string {
  // USDC has 6 decimals
  const num = Number(amountRaw) / 1e6
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MerchantReceiptsPage() {
  const { charges, total, page, isLoading, error, setPage, refetch } = useMerchantCharges(PAGE_SIZE)
  const { chainConfig } = useChain()
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const explorerTxUrl = (txHash: string) =>
    `${chainConfig.explorer}/tx/${txHash}`

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Charge Receipts</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Successful charges with IPFS receipts
          </p>
        </div>
        {total > 0 && (
          <span className="text-xs text-muted-foreground">
            {total} charge{total !== 1 ? 's' : ''}
          </span>
        )}
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
      {!isLoading && !error && charges.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm text-muted-foreground">
              No successful charges yet. Receipts will appear here after subscribers are charged.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Charges table */}
      {!isLoading && !error && charges.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Subscriber</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Fee</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Tx Hash</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((charge) => (
                  <tr key={charge.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {formatDate(charge.completedAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {truncateAddress(charge.payer)}
                    </td>
                    <td className="px-4 py-3 text-xs text-right tabular-nums font-medium">
                      ${formatAmount(charge.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-right tabular-nums text-muted-foreground">
                      {charge.protocolFee ? `$${formatAmount(charge.protocolFee)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {charge.txHash ? (
                        <a
                          href={explorerTxUrl(charge.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline font-mono"
                        >
                          {truncateAddress(charge.txHash)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {charge.receiptCid ? (
                        <a
                          href={`${IPFS_GATEWAY}/${charge.receiptCid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          View on IPFS
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-3 w-3" />
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
