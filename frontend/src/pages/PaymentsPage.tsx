import { useState } from 'react'
import { useWallet } from '../hooks/useWallet'
import { usePayments } from '../hooks/usePayments'
import { useChain } from '../hooks'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { ArrowUpRight, ArrowDownLeft, ExternalLink, Loader2, Send } from 'lucide-react'
import { useDisplayName } from '../hooks/useEns'
import type { PaymentRecord } from '../lib/relayer'

type Filter = 'all' | 'sent' | 'received'

function PaymentRow({ payment, currentAddress, explorer }: { payment: PaymentRecord; currentAddress: string; explorer: string }) {
  const isSent = payment.from.toLowerCase() === currentAddress.toLowerCase()
  const otherAddress = isSent ? payment.to : payment.from
  const { displayName, isEns } = useDisplayName(otherAddress)
  const usdcAmount = (Number(BigInt(payment.amount)) / 1_000_000).toFixed(2)

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/10 last:border-b-0 hover:bg-muted/20 transition-colors">
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${isSent ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
        {isSent ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{isSent ? 'Sent' : 'Received'}</span>
          <span className="text-xs text-muted-foreground">
            {isSent ? 'to' : 'from'}
          </span>
          <span className={`text-sm truncate ${isEns ? 'font-medium' : 'font-mono'}`}>{displayName}</span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {new Date(payment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {' · '}
          {new Date(payment.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-semibold tabular-nums ${isSent ? 'text-red-600' : 'text-green-600'}`}>
          {isSent ? '-' : '+'}{usdcAmount} USDC
        </div>
      </div>
      <a
        href={`${explorer}/tx/${payment.txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground/40 hover:text-primary transition-colors shrink-0"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  )
}

export function PaymentsPage() {
  const { address } = useWallet()
  const { chainConfig } = useChain()
  const { payments, isLoading } = usePayments()
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = payments.filter(p => {
    if (filter === 'sent') return p.from.toLowerCase() === address?.toLowerCase()
    if (filter === 'received') return p.to.toLowerCase() === address?.toLowerCase()
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="py-3 px-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Payment History</CardTitle>
            </div>
            <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
              {(['all', 'sent', 'received'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all capitalize ${
                    filter === f ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Send className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {filter === 'all' ? 'No payments yet' : `No ${filter} payments`}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">Send USDC from the dashboard to get started</p>
            </div>
          ) : (
            filtered.map((p) => (
              <PaymentRow
                key={p.txHash}
                payment={p}
                currentAddress={address || ''}
                explorer={chainConfig.explorer}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
