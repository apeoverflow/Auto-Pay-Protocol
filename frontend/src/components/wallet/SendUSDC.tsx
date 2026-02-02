import * as React from 'react'
import { useTransfer } from '../../hooks'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card'
import { StatusMessage } from '../common/StatusMessage'
import { Send, CheckCircle, Loader2, ExternalLink } from 'lucide-react'
import { BLOCK_EXPLORER_URL } from '../../config'

interface SendUSDCProps {
  compact?: boolean
  /** Render just the form — no Card wrapper. Useful inside drawers/modals. */
  inline?: boolean
}

export function SendUSDC({ compact = false, inline = false }: SendUSDCProps) {
  const { hash, userOpHash, status, isLoading, sendUSDC } = useTransfer()
  const [to, setTo] = React.useState('')
  const [amount, setAmount] = React.useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!to || !amount) return
    await sendUSDC(to as `0x${string}`, amount)
  }

  if (inline) {
    return (
      <div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Recipient address (0x...)"
            className="h-10 text-sm"
          />
          <div className="flex gap-2">
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              type="number"
              step="0.000001"
              className="h-10 text-sm flex-1"
            />
            <Button
              type="submit"
              disabled={isLoading || !to || !amount}
              className="h-10 px-5 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/20 flex-shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>

        {status && <StatusMessage message={status} className="mt-3 text-xs" />}

        {hash && (
          <div className="mt-3 p-3 bg-success/10 border border-success/20 rounded-xl text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-success">
                <CheckCircle className="h-3.5 w-3.5" />
                <span className="font-medium">Confirmed</span>
              </div>
              <a
                href={`${BLOCK_EXPLORER_URL}/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline font-medium"
              >
                View tx <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (compact) {
    return (
      <Card className="">
        <CardHeader className="py-2.5 md:py-3.5 px-3.5 md:px-5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 md:h-8 md:w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-indigo-500/5">
              <Send className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
            </div>
            <CardTitle className="text-[14px] md:text-[15px] font-semibold">Send USDC</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-3.5 md:px-5 pb-3 md:pb-5 pt-3 md:pt-4">
          <form onSubmit={handleSubmit} className="space-y-2 md:space-y-3">
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Recipient (0x...)"
              className="h-8 md:h-9 text-[13px] md:text-sm"
            />

            <div className="flex gap-2">
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                type="number"
                step="0.000001"
                className="h-8 md:h-9 text-[13px] md:text-sm flex-1"
              />
              <Button
                type="submit"
                disabled={isLoading || !to || !amount}
                className="h-8 md:h-9 px-4 text-[13px] md:text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/20 flex-shrink-0"
                size="sm"
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
              </Button>
            </div>
          </form>

          {status && <StatusMessage message={status} className="mt-2 text-xs" />}

          {hash && (
            <div className="mt-3 p-2.5 bg-success/10 border border-success/20 rounded-lg text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-success">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span className="font-medium">Confirmed</span>
                </div>
                <a
                  href={`${BLOCK_EXPLORER_URL}/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline font-medium"
                >
                  View tx <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-indigo-500/5">
            <Send className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-lg">Send USDC</CardTitle>
        </div>
        <CardDescription>
          Transfer USDC gaslessly using your smart wallet
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Recipient address (0x...)"
            label="To"
          />

          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            label="Amount (USDC)"
            type="number"
            step="0.000001"
          />

          <Button
            type="submit"
            disabled={isLoading || !to || !amount}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/20"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send USDC
              </>
            )}
          </Button>
        </form>

        <StatusMessage message={status} />

        {userOpHash && (
          <div className="mt-4 p-3 bg-muted rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="font-medium">UserOp Hash</span>
            </div>
            <code className="text-xs font-mono break-all">{userOpHash}</code>
          </div>
        )}

        {hash && (
          <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Transaction Confirmed</span>
              </div>
              <a
                href={`${BLOCK_EXPLORER_URL}/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
              >
                View on Explorer <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <code className="text-xs font-mono break-all">{hash}</code>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
