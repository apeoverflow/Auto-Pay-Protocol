/**
 * Tempo Wallet Context
 *
 * On Tempo builds, wallets are created and managed server-side via the relayer
 * (Privy Node SDK). The relayer stores the user→wallet mapping in the database.
 * The frontend calls /api/tempo/create-wallet on each login — the relayer
 * returns the existing wallet if one exists, or creates a new one.
 *
 * No localStorage caching — the database is the source of truth.
 */
import * as React from 'react'
import { createPublicClient, http, type PublicClient } from 'viem'
import { CHAIN_CONFIGS, DEFAULT_CHAIN } from '../config/chains'
import { tempoCreateWallet } from '../lib/tempo-api'

import { usePrivy } from '@privy-io/react-auth'

interface TempoWalletState {
  address: `0x${string}` | null
  publicClient: PublicClient | null
  walletClient: null // Always null — signing is server-side via relayer
  isConnected: boolean
  isReady: boolean
  login: () => void
  logout: () => void
  getAccessToken: () => Promise<string | null>
  walletId: string | null
}

const defaultState: TempoWalletState = {
  address: null,
  publicClient: null,
  walletClient: null,
  isConnected: false,
  isReady: true,
  login: () => {},
  logout: () => {},
  getAccessToken: async () => null,
  walletId: null,
}

const TempoWalletContext = React.createContext<TempoWalletState>(defaultState)

function TempoWalletInner({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, login, logout, getAccessToken, user } = usePrivy()

  const chainConfig = CHAIN_CONFIGS[DEFAULT_CHAIN]
  const rpcUrl = chainConfig?.chain.rpcUrls.default.http[0] || 'https://rpc.tempo.xyz'

  const [wallet, setWallet] = React.useState<{ walletId: string; address: string } | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const fetchedForUser = React.useRef<string | null>(null)

  const publicClient = React.useMemo(() => {
    return createPublicClient({
      chain: chainConfig.chain,
      transport: http(rpcUrl),
    })
  }, [rpcUrl])

  // Fetch or create wallet when user authenticates
  React.useEffect(() => {
    if (!authenticated || !ready || !user?.id) return
    if (isLoading) return
    if (fetchedForUser.current === user.id) return // already fetched for this user

    fetchedForUser.current = user.id
    setIsLoading(true)

    getAccessToken().then(async (token) => {
      if (!token) {
        setIsLoading(false)
        return
      }
      try {
        // Relayer checks DB — returns existing wallet or creates new one
        const email = (user as any)?.email?.address || (user as any)?.google?.email
        const result = await tempoCreateWallet(token, email)
        setWallet({ walletId: result.walletId, address: result.address })
      } catch (err) {
        console.error('[Tempo] Failed to get/create wallet:', err)
        fetchedForUser.current = null // allow retry on next render
      } finally {
        setIsLoading(false)
      }
    })
  }, [authenticated, ready, user?.id, isLoading, getAccessToken])

  // Clear wallet on logout
  const handleLogout = React.useCallback(() => {
    setWallet(null)
    fetchedForUser.current = null
    logout()
  }, [logout])

  const value = React.useMemo(() => ({
    address: wallet?.address as `0x${string}` | null,
    publicClient,
    walletClient: null,
    isConnected: !!wallet && authenticated,
    isReady: ready && !isLoading,
    login,
    logout: handleLogout,
    getAccessToken,
    walletId: wallet?.walletId || null,
  }), [wallet, publicClient, authenticated, ready, isLoading, login, handleLogout, getAccessToken])

  return (
    <TempoWalletContext.Provider value={value}>
      {children}
    </TempoWalletContext.Provider>
  )
}

function TempoWalletNoop({ children }: { children: React.ReactNode }) {
  return (
    <TempoWalletContext.Provider value={defaultState}>
      {children}
    </TempoWalletContext.Provider>
  )
}

export function TempoWalletProvider({ children }: { children: React.ReactNode }) {
  const isTempo = DEFAULT_CHAIN === 'tempo'
  if (!isTempo) return <TempoWalletNoop>{children}</TempoWalletNoop>
  return <TempoWalletInner>{children}</TempoWalletInner>
}

export function useTempoWallet() {
  return React.useContext(TempoWalletContext)
}

export function isTempoBuild(): boolean {
  return DEFAULT_CHAIN === 'tempo'
}
