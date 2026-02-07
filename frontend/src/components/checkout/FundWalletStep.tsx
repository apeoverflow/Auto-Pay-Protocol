import * as React from 'react'
import { Wallet, Copy, Check, ExternalLink, RefreshCw, ArrowRight, Send, Droplets, ArrowUpRight, Settings } from 'lucide-react'
import { useWallet } from '../../hooks'
import { formatUSDCString, shortenAddress } from '../../lib/utils'

interface FundWalletStepProps {
  requiredAmount: string // e.g. "9.99"
  gasEstimate: number    // e.g. 0.01
  cancelUrl: string
  onFunded: () => void
}

export function FundWalletStep({ requiredAmount, gasEstimate, cancelUrl, onFunded }: FundWalletStepProps) {
  const { account, balance, fetchBalance } = useWallet()
  const [copied, setCopied] = React.useState(false)
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  const walletAddress = account?.address ?? ''
  const currentBalance = parseFloat(balance ?? '0')
  const subscriptionAmount = parseFloat(requiredAmount)
  const totalNeeded = subscriptionAmount + gasEstimate
  const isFunded = currentBalance >= totalNeeded

  // Poll balance every 5 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchBalance()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchBalance])

  // Auto-advance when funded
  React.useEffect(() => {
    if (isFunded) {
      const timeout = setTimeout(onFunded, 600)
      return () => clearTimeout(timeout)
    }
  }, [isFunded, onFunded])

  const handleCopy = async () => {
    if (!walletAddress) return
    await navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchBalance()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  return (
    <div>
      <div className="text-center mb-5">
        <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-2.5">
          <Wallet className="w-6 h-6 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold">Fund your wallet</h2>
        <p className="text-sm text-muted-foreground mt-1">
          You need <span className="font-semibold text-foreground">${formatUSDCString(totalNeeded.toString())} USDC</span> to subscribe
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          ${formatUSDCString(requiredAmount)} subscription + ~${formatUSDCString(gasEstimate.toString())} gas
        </p>
      </div>

      {/* Balance + Wallet address — side by side */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Balance */}
        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Balance</span>
            <button
              onClick={handleRefresh}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl font-bold ${isFunded ? 'text-green-600' : 'text-foreground'}`}>
              {currentBalance.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">USDC</span>
          </div>
          {!isFunded && (
            <div className="mt-2 text-[11px] text-amber-600 bg-amber-50 rounded-md px-2 py-1">
              Need {(totalNeeded - currentBalance).toFixed(2)} more
            </div>
          )}
          {isFunded && (
            <div className="mt-2 text-[11px] text-green-600 bg-green-50 rounded-md px-2 py-1 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Sufficient
            </div>
          )}
        </div>

        {/* Wallet address */}
        <div className="rounded-xl border border-border bg-card p-3.5">
          <p className="text-xs text-muted-foreground mb-2">Your address</p>
          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-2 group"
          >
            <code className="text-[11px] font-mono bg-muted/50 border border-border rounded-lg px-2.5 py-1.5 flex-1 truncate text-left">
              {walletAddress}
            </code>
            <div className="flex-shrink-0 w-8 h-8 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 flex items-center justify-center transition-colors">
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
              )}
            </div>
          </button>
          {copied && (
            <p className="text-[10px] text-green-500 mt-1.5">Copied to clipboard</p>
          )}
        </div>
      </div>

      {/* Funding options — compact grid */}
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-0.5 mb-2">
        How to fund
      </p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <a
          href="/bridge"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors group text-center"
        >
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
            <ArrowUpRight className="w-4.5 h-4.5 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs font-medium leading-tight">Bridge to Arc</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">From another chain</p>
          </div>
          <ExternalLink className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
        </a>

        <a
          href="https://faucet.circle.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors group text-center"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <Droplets className="w-4.5 h-4.5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs font-medium leading-tight">Testnet USDC</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Circle faucet</p>
          </div>
          <ExternalLink className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
        </a>

        <button
          onClick={handleCopy}
          className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors group text-center"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
            <Send className="w-4.5 h-4.5 text-purple-500" />
          </div>
          <div>
            <p className="text-xs font-medium leading-tight">Send direct</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{shortenAddress(walletAddress)}</p>
          </div>
          <Copy className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
        </button>
      </div>

      {/* Tip */}
      <div className="rounded-lg bg-muted/50 px-3.5 py-2.5 mb-5 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">Tip:</span> Get testnet USDC from the Circle faucet, then send to your address above on <span className="font-medium text-foreground">Arc Testnet</span>. Balance updates automatically.
      </div>

      {/* Continue button */}
      <button
        onClick={onFunded}
        disabled={!isFunded}
        className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isFunded ? (
          <>
            Continue
            <ArrowRight className="w-4 h-4" />
          </>
        ) : (
          <>
            <Wallet className="w-4 h-4" />
            Waiting for funds...
          </>
        )}
      </button>

      {/* Bottom links */}
      <div className="flex items-center justify-center gap-3 mt-3">
        <a href={cancelUrl} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </a>
        <span className="text-xs text-muted-foreground/50">&middot;</span>
        <a
          href="/settings"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <Settings className="w-3 h-3" />
          Manage wallet
        </a>
      </div>
    </div>
  )
}
