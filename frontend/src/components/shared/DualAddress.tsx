/**
 * DualAddress — shows both EVM and Polkadot SS58 addresses on Polkadot Hub.
 * On other chains, shows only the EVM address.
 */
import * as React from 'react'
import { Copy, Check, HelpCircle } from 'lucide-react'
import { useChain } from '../../contexts/ChainContext'
import { evmToSS58, shortenSS58 } from '../../lib/ss58'
import { shortenAddress } from '../../lib/utils'

interface DualAddressProps {
  address: string
  /** Show full addresses (default: shortened) */
  full?: boolean
  /** Show copy buttons (default: false) */
  copyable?: boolean
  /** Additional class for the container */
  className?: string
}

const POLKADOT_HUB_CHAIN_ID = 420420419

export function DualAddress({ address, full = false, copyable = false, className = '' }: DualAddressProps) {
  const { chainConfig } = useChain()
  const isPolkadot = chainConfig.chain.id === POLKADOT_HUB_CHAIN_ID
  const ss58 = isPolkadot && address.length >= 42 ? evmToSS58(address) : null

  const [showHelp, setShowHelp] = React.useState(false)

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {isPolkadot && (
        <div className="flex items-center gap-1 mb-0.5 relative">
          <span className="text-[10px] text-muted-foreground">Same account, two formats</span>
          <button
            onMouseEnter={() => setShowHelp(true)}
            onMouseLeave={() => setShowHelp(false)}
            className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <HelpCircle className="w-3 h-3" />
            {showHelp && (
              <div className="absolute left-0 top-full mt-1 z-50 w-56 p-2 rounded-lg bg-foreground text-background text-[10px] leading-relaxed shadow-lg text-left">
                Polkadot Hub uses SS58 addresses for transfers from exchanges and Substrate wallets. EVM is used by your browser wallet. Both point to the same account.
              </div>
            )}
          </button>
        </div>
      )}
      <AddressRow
        label={isPolkadot ? 'EVM' : undefined}
        value={full ? address : shortenAddress(address)}
        fullValue={address}
        copyable={copyable}
      />
      {ss58 && (
        <AddressRow
          label="Polkadot"
          value={full ? ss58 : shortenSS58(ss58)}
          fullValue={ss58}
          copyable={copyable}
        />
      )}
    </div>
  )
}

function AddressRow({ label, value, fullValue, copyable }: {
  label?: string
  value: string
  fullValue: string
  copyable: boolean
}) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-1.5">
      {label && (
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-14 flex-shrink-0">
          {label}
        </span>
      )}
      <code className="text-[11px] font-mono bg-muted/50 border border-border rounded-md px-2 py-1 truncate flex-1">
        {value}
      </code>
      {copyable && (
        <button
          onClick={handleCopy}
          className="flex-shrink-0 w-6 h-6 rounded-md border border-border bg-muted/30 hover:bg-muted/50 flex items-center justify-center transition-colors"
        >
          {copied ? (
            <Check className="w-3 h-3 text-green-500" />
          ) : (
            <Copy className="w-3 h-3 text-muted-foreground" />
          )}
        </button>
      )}
    </div>
  )
}
