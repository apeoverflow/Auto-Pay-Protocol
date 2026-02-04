import * as React from 'react'
import { formatUnits, erc20Abi } from 'viem'
import { useAccount, useConnect, useDisconnect, useSwitchChain, useReadContract } from 'wagmi'
import confetti from 'canvas-confetti'
import { Button } from '../ui/button'
import {
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  Wallet,
  ChevronDown,
  X,
  Zap,
} from 'lucide-react'
import { useGatewayTransfer } from '../../hooks/useGatewayTransfer'
import {
  GATEWAY_SOURCE_CHAINS,
  USDC_ADDRESSES,
  getSourceChainByChainId,
  type GatewaySourceChain,
} from '../../config/gateway'
import { USDC_DECIMALS } from '../../config'

interface FundWalletCardProps {
  destinationAddress: string
  onSuccess?: () => void
}

// Chain colors for visual identification (keyed by chainId)
const CHAIN_COLORS: Record<number, { gradient: string }> = {
  11155111: { gradient: 'from-[#627EEA] to-[#8B9FEF]' }, // Ethereum Sepolia
  84532: { gradient: 'from-[#0052FF] to-[#3377FF]' },    // Base Sepolia
}


export function FundWalletCard({ destinationAddress, onSuccess }: FundWalletCardProps) {
  const { address, isConnected, chainId } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const { transfer, isLoading, status, error, result, reset } = useGatewayTransfer()

  const [amount, setAmount] = React.useState('10')
  const [selectedChain, setSelectedChain] = React.useState<GatewaySourceChain>(GATEWAY_SOURCE_CHAINS[0])
  const [showChainDropdown, setShowChainDropdown] = React.useState(false)
  const [showWalletSelector, setShowWalletSelector] = React.useState(false)

  const selectedChainId = selectedChain.testnet.ViemChain.id
  const isOnCorrectChain = chainId === selectedChainId
  const usdcAddress = USDC_ADDRESSES[selectedChainId]
  const chainStyle = CHAIN_COLORS[selectedChainId] || CHAIN_COLORS[11155111]

  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: selectedChainId,
  })

  // Confetti explosion on successful transfer
  React.useEffect(() => {
    if (result) {
      const duration = 2000
      const end = Date.now() + duration

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ['#10B981', '#3B82F6', '#8B5CF6'],
        })
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ['#10B981', '#3B82F6', '#8B5CF6'],
        })

        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      }
      frame()
    }
  }, [result])

  const filteredConnectors = connectors.filter((c) => c.id !== 'injected')

  const handleSelectChain = (chain: GatewaySourceChain) => {
    setSelectedChain(chain)
    setShowChainDropdown(false)
  }

  const handleConnect = (connectorId: string) => {
    const connector = connectors.find(c => c.id === connectorId)
    if (connector) {
      connect({ connector })
      setShowWalletSelector(false)
    }
  }

  const handleSwitchChain = () => {
    switchChain({ chainId: selectedChainId })
  }

  const handleFund = async () => {
    try {
      await transfer({
        sourceChain: selectedChain,
        amount,
        recipientAddress: destinationAddress as `0x${string}`,
      })
      refetchBalance()
      onSuccess?.()
    } catch {
      // Error handled in hook
    }
  }

  React.useEffect(() => {
    if (chainId) {
      const chain = getSourceChainByChainId(chainId)
      if (chain) setSelectedChain(chain)
    }
  }, [chainId])

  // Success state
  if (result) {
    return (
      <div className="fund-card fund-card--success">
        <div className="fund-success-header">
          <div className="fund-success-icon">
            <Check className="h-6 w-6" />
          </div>
          <div className="fund-success-title">Transfer Complete</div>
          <div className="fund-success-amount">{result.amount} USDC</div>
        </div>

        <div className="fund-success-details">
          <div className="fund-success-row">
            <span className="fund-success-label">From</span>
            <span className="fund-success-value font-mono">{result.sourceAddress.slice(0, 8)}...{result.sourceAddress.slice(-6)}</span>
          </div>
          <div className="fund-success-divider">
            <ArrowRight className="h-3 w-3" />
          </div>
          <div className="fund-success-row">
            <span className="fund-success-label">To</span>
            <span className="fund-success-value font-mono">{result.destinationAddress.slice(0, 8)}...{result.destinationAddress.slice(-6)}</span>
          </div>
        </div>

        {result.mintTxHash && (
          <div className="fund-success-links">
            <a
              href={`https://testnet.arcscan.app/tx/${result.mintTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="fund-success-link"
            >
              View on Arc Explorer <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        <Button onClick={reset} variant="outline" className="w-full mt-4">
          Transfer More
        </Button>
      </div>
    )
  }

  return (
    <div className="fund-card">
      {/* Step 1: Connect Wallet */}
      <div className="fund-section">
        <div className="fund-step-header">
          <div className={`fund-step-indicator ${isConnected ? 'fund-step-indicator--done' : ''}`}>
            {isConnected ? <Check className="h-3 w-3" /> : <span>1</span>}
          </div>
          <span className="fund-step-title">Connect Wallet</span>
        </div>

        {!isConnected ? (
          showWalletSelector ? (
            <div className="fund-wallet-selector">
              <div className="fund-wallet-selector-header">
                <span>Select Wallet</span>
                <button onClick={() => setShowWalletSelector(false)} className="fund-wallet-close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="fund-wallet-list">
                {filteredConnectors.map((connector) => (
                  <button
                    key={connector.id}
                    onClick={() => handleConnect(connector.id)}
                    disabled={isConnecting}
                    className="fund-wallet-option"
                  >
                    <span className="fund-wallet-name">{connector.name}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowWalletSelector(true)}
              disabled={isConnecting}
              className="fund-connect-btn"
            >
              <Wallet className="h-4 w-4" />
              <span>{isConnecting ? 'Connecting...' : 'Connect Browser Wallet'}</span>
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin ml-auto" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-auto" />
              )}
            </button>
          )
        ) : (
          <div className="fund-connected">
            <div className="fund-connected-icon">
              <Wallet className="h-4 w-4" />
            </div>
            <div className="fund-connected-info">
              <span className="fund-connected-label">Connected</span>
              <span className="fund-connected-address">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
            </div>
            <button onClick={() => disconnect()} className="fund-disconnect-btn">
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Step 2: Select Chain */}
      {isConnected && (
        <div className="fund-section">
          <div className="fund-step-header">
            <div className={`fund-step-indicator ${isOnCorrectChain ? 'fund-step-indicator--done' : ''}`}>
              {isOnCorrectChain ? <Check className="h-3 w-3" /> : <span>2</span>}
            </div>
            <span className="fund-step-title">Source Chain</span>
          </div>

          <div className="fund-chain-selector">
            <button
              onClick={() => setShowChainDropdown(!showChainDropdown)}
              className="fund-chain-btn"
            >
              <div className={`fund-chain-dot bg-gradient-to-br ${chainStyle.gradient}`} />
              <span className="fund-chain-name">{selectedChain.name}</span>
              <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showChainDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showChainDropdown && (
              <div className="fund-chain-dropdown">
                {GATEWAY_SOURCE_CHAINS.map((chain) => {
                  const style = CHAIN_COLORS[chain.testnet.ViemChain.id] || CHAIN_COLORS[11155111]
                  const isSelected = chain.testnet.ViemChain.id === selectedChainId
                  return (
                    <button
                      key={chain.testnet.ViemChain.id}
                      onClick={() => handleSelectChain(chain)}
                      className={`fund-chain-option ${isSelected ? 'fund-chain-option--active' : ''}`}
                    >
                      <div className={`fund-chain-dot bg-gradient-to-br ${style.gradient}`} />
                      <span>{chain.name}</span>
                      {isSelected && <Check className="h-4 w-4 ml-auto text-primary" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {isOnCorrectChain && usdcBalance !== undefined && (
            <div className="fund-balance-info">
              Available: <span className="font-semibold">{formatUnits(usdcBalance, USDC_DECIMALS)} USDC</span>
            </div>
          )}

          {!isOnCorrectChain && (
            <Button onClick={handleSwitchChain} disabled={isSwitching} variant="outline" className="w-full mt-3">
              {isSwitching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Switching...
                </>
              ) : (
                <>Switch to {selectedChain.shortName}</>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Step 3: Amount & Transfer */}
      {isConnected && isOnCorrectChain && (
        <div className="fund-section">
          <div className="fund-step-header">
            <div className="fund-step-indicator">
              <span>3</span>
            </div>
            <span className="fund-step-title">Amount</span>
          </div>

          <div className="fund-amount-input-wrap">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="fund-amount-input"
            />
            <div className="fund-amount-suffix">
              <div className="fund-usdc-icon">$</div>
              <span>USDC</span>
            </div>
          </div>

          <div className="fund-destination">
            <div className="fund-destination-label">
              <span>Destination</span>
              <span className="fund-destination-badge">Arc Testnet</span>
            </div>
            <div className="fund-destination-address">{destinationAddress}</div>
          </div>

          <Button
            onClick={handleFund}
            disabled={isLoading || !amount || parseFloat(amount) <= 0}
            className="fund-transfer-btn"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {status || 'Processing...'}
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Transfer {amount} USDC
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>

          {error && (
            <div className="fund-error">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
