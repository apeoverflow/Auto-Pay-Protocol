import * as React from 'react'
import { createPublicClient, http, type PublicClient } from 'viem'
import { useWalletClient, type UseWalletClientReturnType } from 'wagmi'
import {
  CHAIN_CONFIGS,
  DEFAULT_CHAIN,
  type ChainKey,
  type ChainConfig,
} from '../config/chains'

interface ChainContextValue {
  chainKey: ChainKey
  chainConfig: ChainConfig
  publicClient: PublicClient | null
  walletClient: UseWalletClientReturnType['data'] | undefined
  isReady: boolean
}

const ChainContext = React.createContext<ChainContextValue | null>(null)

export function ChainProvider({ children }: { children: React.ReactNode }) {
  // Each deployment is pinned to one chain via VITE_DEFAULT_CHAIN.
  // No localStorage override — subdomain deployments are authoritative.
  const chainKey = DEFAULT_CHAIN
  const chainConfig = CHAIN_CONFIGS[chainKey]
  const { data: walletClient } = useWalletClient({ chainId: chainConfig.chain.id })

  // Create a public client for reading chain data
  const publicClient = React.useMemo(() => {
    if (!chainConfig) return null
    return createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.chain.rpcUrls.default.http[0]),
    })
  }, [chainKey])

  const value = React.useMemo(
    () => ({
      chainKey,
      chainConfig,
      publicClient,
      walletClient,
      isReady: !!publicClient,
    }),
    [chainKey, chainConfig, publicClient, walletClient]
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
