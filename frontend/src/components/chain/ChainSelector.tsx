import { CHAIN_CONFIGS, DEFAULT_CHAIN } from '../../config/chains'

const chain = CHAIN_CONFIGS[DEFAULT_CHAIN]

const CHAIN_ICONS: Record<string, string> = {
  flowEvm: '/flow-icon.svg',
  base: '/base-icon.svg',
}

export function ChainSelector() {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm">
      <img src={CHAIN_ICONS[DEFAULT_CHAIN] || ''} alt={chain.shortName} className="h-4 w-4" />
      <span className="hidden sm:inline">{chain.name}</span>
    </div>
  )
}
