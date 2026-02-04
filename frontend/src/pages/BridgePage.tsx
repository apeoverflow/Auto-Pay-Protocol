import * as React from 'react'
import { useWallet } from '../hooks'
import { FundWalletCard } from '../components/FundWallet'
import { Copy, Check, ExternalLink } from 'lucide-react'

export function BridgePage() {
  const { account, balance, fetchBalance } = useWallet()
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatBalance = (bal: string | null) => {
    if (bal === null) return '0.00'
    const value = parseFloat(bal)
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return (
    <div className="bridge-page">
      <div className="bridge-layout">
        {/* Main card */}
        <div className="bridge-main">
          {account?.address && (
            <FundWalletCard
              destinationAddress={account.address}
              onSuccess={fetchBalance}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="bridge-sidebar">
          {/* Arc Balance */}
          <div className="bridge-balance">
            <div className="bridge-balance-row">
              <span className="bridge-balance-label">Arc Balance</span>
              <div className="bridge-balance-amount">
                <span className="bridge-balance-value">{formatBalance(balance)}</span>
                <span className="bridge-balance-unit">USDC</span>
              </div>
            </div>
            <button onClick={handleCopy} className="bridge-address-btn">
              <span>{account?.address?.slice(0, 6)}...{account?.address?.slice(-4)}</span>
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>

          {/* How it works */}
          <div className="bridge-section">
            <div className="bridge-section-title">How it works</div>
            <div className="bridge-steps">
              <div className="bridge-step">
                <div className="bridge-step-num">1</div>
                <div className="bridge-step-text">
                  <div className="bridge-step-title">Connect</div>
                  <div className="bridge-step-desc">Link browser wallet</div>
                </div>
              </div>
              <div className="bridge-step">
                <div className="bridge-step-num">2</div>
                <div className="bridge-step-text">
                  <div className="bridge-step-title">Select</div>
                  <div className="bridge-step-desc">Choose source chain</div>
                </div>
              </div>
              <div className="bridge-step">
                <div className="bridge-step-num">3</div>
                <div className="bridge-step-text">
                  <div className="bridge-step-title">Transfer</div>
                  <div className="bridge-step-desc">Instant via Gateway</div>
                </div>
              </div>
            </div>
          </div>

          {/* Supported chains */}
          <div className="bridge-section">
            <div className="bridge-section-title">Supported Networks</div>
            <div className="bridge-networks bridge-networks--grid">
              <div className="bridge-network">
                <span className="bridge-network-dot" style={{ background: '#627EEA' }} />
                Ethereum
              </div>
              <div className="bridge-network">
                <span className="bridge-network-dot" style={{ background: '#E84142' }} />
                Avalanche
              </div>
              <div className="bridge-network">
                <span className="bridge-network-dot" style={{ background: '#0052FF' }} />
                Base
              </div>
              <div className="bridge-network">
                <span className="bridge-network-dot" style={{ background: '#19FB9B' }} />
                Sonic
              </div>
              <div className="bridge-network">
                <span className="bridge-network-dot" style={{ background: '#000' }} />
                World Chain
              </div>
              <div className="bridge-network">
                <span className="bridge-network-dot" style={{ background: '#9B1C1C' }} />
                Sei
              </div>
              <div className="bridge-network">
                <span className="bridge-network-dot" style={{ background: '#50E2C1' }} />
                HyperEVM
              </div>
            </div>
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noreferrer"
              className="bridge-faucet-link"
            >
              Need testnet USDC? <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Gateway badge */}
          <div className="bridge-cctp">
            <svg viewBox="0 0 24 24" fill="none" className="bridge-cctp-icon">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 12h8M12 8l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="bridge-cctp-text">
              <span className="bridge-cctp-label">Powered by</span>
              <span className="bridge-cctp-name">Circle Gateway</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
