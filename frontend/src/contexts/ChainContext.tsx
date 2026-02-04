import * as React from 'react'
import { createPublicClient, http, type PublicClient } from 'viem'
import { createBundlerClient, type BundlerClient } from 'viem/account-abstraction'
import { toModularTransport } from '@circle-fin/modular-wallets-core'
import { clientKey, clientUrl, isConfigured } from '../config'
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
  // Direct RPC client for reading chain data (getLogs, readContract, etc.)
  publicClient: PublicClient | null
  // Circle client for SDK operations (toCircleSmartAccount)
  circleClient: PublicClient | null
  // Circle bundler client for sending UserOps (uses Circle's paymaster)
  bundlerClient: BundlerClient | null
  isReady: boolean
}

const ChainContext = React.createContext<ChainContextValue | null>(null)

function createClientsForChain(chainKey: ChainKey) {
  const config = CHAIN_CONFIGS[chainKey]
  if (!config) {
    return { publicClient: null, circleClient: null, bundlerClient: null }
  }

  // Create a direct public client using the chain's native RPC
  // This is used for reading data (getLogs, readContract, getBlock, etc.)
  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.chain.rpcUrls.default.http[0]),
  })

  // Create Circle clients only if Circle SDK is configured
  let circleClient: PublicClient | null = null
  let bundlerClient: BundlerClient | null = null

  if (isConfigured) {
    const modularTransport = toModularTransport(`${clientUrl}/${config.transportPath}`, clientKey!)

    // Circle client for SDK operations (toCircleSmartAccount)
    circleClient = createPublicClient({
      chain: config.chain,
      transport: modularTransport,
    })

    // Bundler client for sending UserOps with paymaster
    bundlerClient = createBundlerClient({
      chain: config.chain,
      transport: modularTransport,
    })
  }

  return { publicClient, circleClient, bundlerClient }
}

export function ChainProvider({ children }: { children: React.ReactNode }) {
  const [chainKey, setChainKeyState] = React.useState<ChainKey>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && CHAIN_CONFIGS[stored]) {
      return stored as ChainKey
    }
    return DEFAULT_CHAIN
  })

  const chainConfig = CHAIN_CONFIGS[chainKey]

  // Memoize clients - recreate only when chain changes
  const clients = React.useMemo(() => {
    return createClientsForChain(chainKey)
  }, [chainKey])

  // Persist chain selection
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
      publicClient: clients.publicClient,
      circleClient: clients.circleClient,
      bundlerClient: clients.bundlerClient,
      isReady: !!clients.publicClient,
    }),
    [chainKey, chainConfig, setChainKey, clients]
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
