import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useChain } from '../../contexts/ChainContext'
import { CHAIN_CONFIGS, type ChainKey } from '../../config/chains'

const CHAIN_ICONS: Record<string, string> = {
  flowEvm: '/flow-icon.svg',
  base: '/base-square.svg',
  polkadotHub: '/polkadot-icon.svg',
  tempo: '/tempo-icon.svg',
  arbitrum: '/arbitrum-icon.svg',
  arcTestnet: '/arc-logo.jpg',
}

// Tempo (Privy embedded wallet) and Arc (WebAuthn passkey) require a secure
// context — https:// or http://localhost. Over plain-HTTP origins they crash,
// so disable them there.
const SECURE_CONTEXT_CHAINS = new Set<ChainKey>(['tempo', 'arcTestnet'])
const isSecureContext = typeof window !== 'undefined' ? window.isSecureContext : true

interface CheckoutChainSelectorProps {
  /** Chains the merchant offers for this plan (payer picks one). */
  chains: ChainKey[]
}

/**
 * Lets the payer choose which chain to subscribe on. EVM switches are instant;
 * Tempo/Arc persist + reload (handled by ChainContext.setChainKey) so the app
 * boots with the right wallet providers.
 */
export function CheckoutChainSelector({ chains }: CheckoutChainSelectorProps) {
  const { chainKey, chainConfig, setChainKey } = useChain()
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (chains.length <= 1) return null

  return (
    <div className="mb-5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
        Pay on
      </p>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
        >
          <img
            src={CHAIN_ICONS[chainKey] || ''}
            alt=""
            className="h-5 w-5 rounded-full object-cover ring-1 ring-border/40"
          />
          <span className="flex-1">{chainConfig.name}</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg"
          >
            {chains.map((key) => {
              const cfg = CHAIN_CONFIGS[key]
              const active = key === chainKey
              const disabled = SECURE_CONTEXT_CHAINS.has(key) && !isSecureContext
              return (
                <button
                  key={key}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={disabled}
                  title={disabled ? 'Requires HTTPS or localhost' : undefined}
                  onClick={() => {
                    setChainKey(key)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors ${
                    disabled
                      ? 'cursor-not-allowed opacity-40'
                      : active
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted/50'
                  }`}
                >
                  <img
                    src={CHAIN_ICONS[key] || ''}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover ring-1 ring-border/40"
                  />
                  <span className="flex-1 font-medium">{cfg.name}</span>
                  {disabled && <span className="text-[10px] font-medium text-muted-foreground">HTTPS</span>}
                  {active && <Check className="h-4 w-4 text-primary" />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
