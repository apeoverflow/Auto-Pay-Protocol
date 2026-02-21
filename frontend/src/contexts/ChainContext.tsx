import * as React from 'react'
import { createPublicClient, http, type PublicClient } from 'viem'
import { useWalletClient, type UseWalletClientReturnType } from 'wagmi'
import {
  CHAIN_CONFIGS,
  DEFAULT_CHAIN,
  type ChainKey,
  type ChainConfig,
} from '../config/chains'

const STORAGE_KEY = 'selectedChain'

interface ChainContextValue {
  chainKey: ChainKey
  chainConfig: ChainConfig
  setChainKey: (key: ChainKey) => void
  publicClient: PublicClient | null
  walletClient: UseWalletClientReturnType['data'] | undefined
  isReady: boolean
}

const ChainContext = React.createContext<ChainContextValue | null>(null)

export function ChainProvider({ children }: { children: React.ReactNode }) {
  const [chainKey, setChainKeyState] = React.useState<ChainKey>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && CHAIN_CONFIGS[stored]) {
      return stored as ChainKey
    }
    return DEFAULT_CHAIN
  })

  const chainConfig = CHAIN_CONFIGS[chainKey]
  const { data: walletClient } = useWalletClient()

  // Create a public client for reading chain data
  const publicClient = React.useMemo(() => {
    if (!chainConfig) return null
    return createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.chain.rpcUrls.default.http[0]),
    })
  }, [chainKey])

  const setChainKey = React.useCallback((key: ChainKey) => {
    if (CHAIN_CONFIGS[key]) {
      localStorage.setItem(STORAGE_KEY, key)
      setChainKeyState(key)
    }
  }, [])

  const value = React.useMemo(
    () => ({
      chainKey,
      chainConfig,
      setChainKey,
      publicClient,
      walletClient,
      isReady: !!publicClient,
    }),
    [chainKey, chainConfig, setChainKey, publicClient, walletClient]
  )

  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>
}

export function useChain() {
  const context = React.useContext(ChainContext)
  if (!context) {
    throw new Error('useChain must be used within a ChainProvider')
  }
  return context
}
