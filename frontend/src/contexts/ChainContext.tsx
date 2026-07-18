import * as React from 'react'
import { createPublicClient, http, type PublicClient } from 'viem'
import { useWalletClient, type UseWalletClientReturnType, useAccount, useSwitchChain } from 'wagmi'
import {
  CHAIN_CONFIGS,
  type ChainKey,
  type ChainConfig,
} from '../config/chains'
import { isTempoBuild, useTempoWallet } from './TempoWalletContext'
import { isArcBuild, useArcWallet } from './ArcWalletContext'
import { CHAIN_STORAGE_KEY, resolveActiveChainKey } from '../config/activeChain'

// Chains selectable at runtime from the topbar switcher. Standard EVM chains
// switch in place; Tempo (Privy) and Arc (passkey) use special wallet modes
// wired at the app root, so selecting them persists the choice and reloads.
export const SWITCHABLE_CHAIN_KEYS = (['flowEvm', 'base', 'arbitrum', 'polkadotHub', 'tempo', 'arcTestnet'] as ChainKey[])
  .filter((k) => CHAIN_CONFIGS[k]?.policyManager)

type WalletMode = 'evm' | 'tempo' | 'arc'

// The wallet mode a chain requires. Switching across modes needs the app root
// re-wired (Privy / passkey providers), so it triggers a reload.
function walletModeFor(key: ChainKey): WalletMode {
  if (key === 'tempo') return 'tempo'
  if (key === 'arcTestnet') return 'arc'
  return 'evm'
}

interface ChainContextValue {
  chainKey: ChainKey
  chainConfig: ChainConfig
  publicClient: PublicClient | null
  walletClient: UseWalletClientReturnType['data'] | undefined
  isReady: boolean
  /** Chains the user can switch between from the topbar */
  selectableChains: ChainConfig[]
  /** Switch the active consolidation chain (persisted to localStorage) */
  setChainKey: (key: ChainKey) => void
  /** Disable auto-switch (e.g. on the bridge page where cross-chain is needed) */
  setSuppressAutoSwitch: (suppress: boolean) => void
}

const ChainContext = React.createContext<ChainContextValue | null>(null)

export function ChainProvider({ children }: { children: React.ReactNode }) {
  // Initial chain comes from the same resolver the root wallet-mode gates use,
  // so state and provider wiring always agree on boot.
  const [chainKey, setChainKeyState] = React.useState<ChainKey>(resolveActiveChainKey)
  const chainConfig = CHAIN_CONFIGS[chainKey]

  const setChainKey = React.useCallback((key: ChainKey) => {
    if (!CHAIN_CONFIGS[key] || key === chainKey) return
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CHAIN_STORAGE_KEY, key)
    }
    // Crossing a wallet-mode boundary (into/out of Tempo or Arc) requires the
    // app root to re-mount the right providers — reload so the resolver re-wires
    // them. EVM↔EVM switches update in place.
    if (walletModeFor(key) !== walletModeFor(chainKey)) {
      if (typeof window !== 'undefined') window.location.reload()
      return
    }
    setChainKeyState(key)
  }, [chainKey])

  const selectableChains = React.useMemo(
    () => SWITCHABLE_CHAIN_KEYS.map((k) => CHAIN_CONFIGS[k]),
    []
  )
  const requiredChainId = chainConfig.chain.id
  const isTempo = isTempoBuild()

  // Standard wagmi wallet (non-Tempo chains)
  const { data: wagmiWalletClient } = useWalletClient({ chainId: requiredChainId })
  const { chainId: connectedChainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const [suppressAutoSwitch, setSuppressAutoSwitch] = React.useState(false)

  // Tempo wallet (local keypair — only used when VITE_DEFAULT_CHAIN=tempo)
  const tempoWallet = useTempoWallet()

  // Arc wallet (passkey/Circle smart account — only used when VITE_DEFAULT_CHAIN=arcTestnet)
  const arcWallet = useArcWallet()
  const isArc = isArcBuild()
  const isArcPasskey = isArc && arcWallet.isPasskeyMode

  // Auto-switch wallet to the required chain when connected on the wrong one.
  // Suppressed on the bridge page, for Tempo (no injected wallet), and for Arc
  // passkey mode (also no injected wallet).
  React.useEffect(() => {
    if (suppressAutoSwitch || isTempo || isArcPasskey) return
    if (isConnected && connectedChainId && connectedChainId !== requiredChainId) {
      switchChain?.({ chainId: requiredChainId })
    }
  }, [isConnected, connectedChainId, requiredChainId, switchChain, suppressAutoSwitch, isTempo, isArcPasskey])

  // Create a public client for reading chain data
  const publicClient = React.useMemo(() => {
    // For Tempo, use the TempoWallet's publicClient
    if (isTempo && tempoWallet.publicClient) {
      return tempoWallet.publicClient as PublicClient
    }
    // For Arc passkey mode, use the ArcWallet's publicClient
    if (isArcPasskey && arcWallet.publicClient) {
      return arcWallet.publicClient as PublicClient
    }
    if (!chainConfig) return null
    return createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.chain.rpcUrls.default.http[0]),
    })
  }, [chainKey, isTempo, tempoWallet.publicClient, isArcPasskey, arcWallet.publicClient])

  // Choose walletClient based on wallet mode:
  //  - Tempo: server-side Privy walletClient (signing via relayer)
  //  - Arc passkey: Circle bundler client (signing via WebAuthn → UserOp)
  //  - Everything else: standard wagmi walletClient
  const walletClient = isTempo
    ? (tempoWallet.walletClient as unknown as UseWalletClientReturnType['data'])
    : isArcPasskey
      ? (arcWallet.walletClient as unknown as UseWalletClientReturnType['data'])
      : wagmiWalletClient

  const value = React.useMemo(
    () => ({
      chainKey,
      chainConfig,
      publicClient,
      walletClient,
      isReady: !!publicClient,
      selectableChains,
      setChainKey,
      setSuppressAutoSwitch,
    }),
    [chainKey, chainConfig, publicClient, walletClient, selectableChains, setChainKey]
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
