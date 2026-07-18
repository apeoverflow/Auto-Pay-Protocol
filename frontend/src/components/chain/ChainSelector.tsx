import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useChain } from '../../contexts/ChainContext'
import type { ChainKey } from '../../config/chains'

const CHAIN_ICONS: Record<string, string> = {
  flowEvm: '/flow-icon.svg',
  base: '/base-square.svg',
  polkadotHub: '/polkadot-icon.svg',
  tempo: '/tempo-icon.svg',
  arbitrum: '/arbitrum-icon.svg',
  arcTestnet: '/arc-logo.jpg',
  baseSepolia: '/base-square.svg',
}

export function ChainSelector() {
  const { chainKey, chainConfig, selectableChains, setChainKey } = useChain()
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

  // Nothing to switch between (e.g. special-wallet builds) — render a static pill.
  if (selectableChains.length <= 1) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm">
        <img
          src={CHAIN_ICONS[chainKey] || ''}
          alt={chainConfig.shortName}
          className="h-5 w-5 rounded-full object-cover ring-1 ring-border/40"
        />
        <span className="hidden sm:inline">{chainConfig.name}</span>
      </div>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/50"
      >
        <img
          src={CHAIN_ICONS[chainKey] || ''}
          alt={chainConfig.shortName}
          className="h-5 w-5 rounded-full object-cover ring-1 ring-border/40"
        />
        <span className="hidden sm:inline">{chainConfig.name}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-52 overflow-hidden rounded-xl border border-border/60 bg-white p-1 shadow-lg">
          {selectableChains.map((c) => {
            const key = c.key as ChainKey
            const active = key === chainKey
            return (
              <button
                key={key}
                onClick={() => {
                  setChainKey(key)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                  active ? 'bg-blue-50 text-blue-700' : 'text-foreground hover:bg-muted/60'
                }`}
              >
                <img
                  src={CHAIN_ICONS[key] || ''}
                  alt={c.shortName}
                  className="h-5 w-5 rounded-full object-cover ring-1 ring-border/40"
                />
                <span className="flex-1 font-medium">{c.name}</span>
                {active && <Check className="h-4 w-4 text-blue-600" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
