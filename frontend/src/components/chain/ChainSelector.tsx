import * as React from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { useChain } from '../../contexts/ChainContext'
import { CHAIN_CONFIGS, ENABLED_CHAINS, type ChainKey } from '../../config/chains'

// Chain colors/icons
const chainTheme: Record<string, { bg: string; text: string; icon: string }> = {
  arcTestnet: { bg: 'bg-purple-100', text: 'text-purple-700', icon: 'A' },
  polygonAmoy: { bg: 'bg-violet-100', text: 'text-violet-700', icon: 'P' },
  arbitrumSepolia: { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'A' },
}

function getChainTheme(key: string) {
  return chainTheme[key] || { bg: 'bg-gray-100', text: 'text-gray-700', icon: '?' }
}

export function ChainSelector() {
  const { chainKey, chainConfig, setChainKey } = useChain()
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const currentTheme = getChainTheme(chainKey)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (key: ChainKey) => {
    setChainKey(key)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-full border border-border/50 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/50"
      >
        <div
          className={`flex h-4 w-4 items-center justify-center rounded-full ${currentTheme.bg} ${currentTheme.text} text-[9px] font-bold`}
        >
          {currentTheme.icon}
        </div>
        <span className="hidden sm:inline">{chainConfig.shortName}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[160px] overflow-hidden rounded-lg border border-border/50 bg-white shadow-lg">
          <div className="py-1">
            {/* Enabled chains */}
            {ENABLED_CHAINS.map((config) => {
              const theme = getChainTheme(config.key)
              const isSelected = config.key === chainKey

              return (
                <button
                  key={config.key}
                  onClick={() => handleSelect(config.key as ChainKey)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    isSelected ? 'bg-muted/50' : 'hover:bg-muted/30'
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${theme.bg} ${theme.text} text-[10px] font-bold`}
                  >
                    {theme.icon}
                  </div>
                  <span className="flex-1 font-medium">{config.name}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              )
            })}

            {/* Disabled chains (coming soon) */}
            {Object.values(CHAIN_CONFIGS)
              .filter((c) => !c.enabled)
              .map((config) => {
                const theme = getChainTheme(config.key)

                return (
                  <div
                    key={config.key}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm opacity-50"
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${theme.bg} ${theme.text} text-[10px] font-bold`}
                    >
                      {theme.icon}
                    </div>
                    <span className="flex-1 font-medium">{config.name}</span>
                    <span className="text-[10px] text-muted-foreground">Soon</span>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
