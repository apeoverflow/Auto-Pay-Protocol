import { CHAIN_CONFIGS, DEFAULT_CHAIN } from '../../config/chains'

const chain = CHAIN_CONFIGS[DEFAULT_CHAIN]

const CHAIN_ICONS: Record<string, string> = {
  flowEvm: '/flow-icon.svg',
  base: '/base-square.svg',
  polkadotHub: '/polkadot-icon.svg',
  tempo: '/tempo-icon.svg',
  arcTestnet: '/arc-logo.jpg',
  baseSepolia: '/base-square.svg',
}

export function ChainSelector() {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm">
      <img
        src={CHAIN_ICONS[DEFAULT_CHAIN] || ''}
        alt={chain.shortName}
        className="h-5 w-5 rounded-full object-cover ring-1 ring-border/40"
      />
      <span className="hidden sm:inline">{chain.name}</span>
    </div>
  )
}
