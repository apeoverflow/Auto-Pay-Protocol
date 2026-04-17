/**
 * Arc Wallet Context
 *
 * On Arc builds, users can choose between:
 *  1. Passkey wallet — Circle Modular Wallets (ERC-4337 smart account with WebAuthn)
 *  2. Browser wallet — standard wagmi (MetaMask, Coinbase, WalletConnect, etc.)
 *
 * This context manages the passkey path. When the user is in passkey mode,
 * ChainContext/WalletContext/AuthContext read from this context instead of wagmi.
 * When in wagmi mode (or unconnected), the standard wagmi path is used.
 *
 * Circle SDK is lazy-loaded inside the inner provider so non-Arc builds don't
 * pay the bundle cost.
 *
 * Env vars required (Arc builds only):
 *   VITE_CLIENT_URL   (Circle Modular Wallets RPC URL)
 *   VITE_CLIENT_KEY   (Circle client key)
 */
import * as React from 'react'
import { createPublicClient, http, type PublicClient } from 'viem'
import { CHAIN_CONFIGS, DEFAULT_CHAIN } from '../config/chains'

type WalletMode = 'passkey' | 'wagmi' | null

interface ArcWalletState {
  address: `0x${string}` | null
  publicClient: PublicClient | null
  /** Bundler client (for passkey mode) that writes UserOps. Typed loosely to interop with wagmi walletClient consumers. */
  walletClient: any | null
  isConnected: boolean
  isReady: boolean
  walletMode: WalletMode
  isPasskeyMode: boolean

  /** Register a new passkey-backed smart account. */
  loginPasskey: (username?: string) => Promise<void>
  /** Login with existing passkey (uses stored credentialId). */
  connectPasskey: () => Promise<void>
  /** Disconnect passkey session (clears in-memory state; credentialId persists in localStorage for reconnect). */
  disconnectPasskey: () => void
  /** Signal that the user chose the browser-wallet path — ChainContext/AuthContext then fall through to wagmi. */
  selectWagmi: () => void
  /** Sign an arbitrary message with the smart account (EIP-191 personal_sign equivalent via WebAuthn). */
  signMessage: (message: string) => Promise<string>

  isLoading: boolean
  error: string | null
}

const defaultState: ArcWalletState = {
  address: null,
  publicClient: null,
  walletClient: null,
  isConnected: false,
  isReady: true,
  walletMode: null,
  isPasskeyMode: false,
  loginPasskey: async () => {},
  connectPasskey: async () => {},
  disconnectPasskey: () => {},
  selectWagmi: () => {},
  signMessage: async () => { throw new Error('Arc passkey not active') },
  isLoading: false,
  error: null,
}

const ArcWalletContext = React.createContext<ArcWalletState>(defaultState)

const CREDENTIAL_KEY = 'autopay-arc-passkey-credential-id'
const USERNAME_KEY = 'autopay-arc-passkey-username'

function ArcWalletInner({ children }: { children: React.ReactNode }) {
  const chainConfig = CHAIN_CONFIGS[DEFAULT_CHAIN]
  const rpcUrl = chainConfig.chain.rpcUrls.default.http[0]

  const clientUrl = import.meta.env.VITE_CLIENT_URL as string | undefined
  const clientKey = import.meta.env.VITE_CLIENT_KEY as string | undefined

  const [walletMode, setWalletMode] = React.useState<WalletMode>(() => {
    // Auto-restore passkey mode if we have a stored credential — the user can
    // call connectPasskey() to re-authenticate.
    if (typeof window !== 'undefined' && localStorage.getItem(CREDENTIAL_KEY)) {
      return 'passkey'
    }
    return null
  })
  const [address, setAddress] = React.useState<`0x${string}` | null>(null)
  const [walletClient, setWalletClient] = React.useState<any | null>(null)
  const smartAccountRef = React.useRef<any | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const publicClient = React.useMemo(() => {
    return createPublicClient({
      chain: chainConfig.chain,
      transport: http(rpcUrl),
    }) as PublicClient
  }, [rpcUrl])

  const createSmartAccount = React.useCallback(async (
    mode: 'Register' | 'Login',
    username?: string,
    credentialId?: string,
  ) => {
    if (!clientUrl || !clientKey) {
      throw new Error('Circle client not configured. Set VITE_CLIENT_URL and VITE_CLIENT_KEY.')
    }

    // Lazy-load Circle SDK + viem bundler bits — only when user actually chooses passkey.
    const [
      {
        toPasskeyTransport,
        toModularTransport,
        toWebAuthnCredential,
        toCircleSmartAccount,
        WebAuthnMode,
      },
      viem,
      aa,
    ] = await Promise.all([
      import('@circle-fin/modular-wallets-core'),
      import('viem'),
      import('viem/account-abstraction'),
    ])

    const passkeyTransport = toPasskeyTransport(clientUrl, clientKey)
    const modularTransport = toModularTransport(clientUrl, clientKey)

    // Create or retrieve the WebAuthn credential
    const credential = await toWebAuthnCredential({
      transport: passkeyTransport,
      username,
      credentialId,
      mode: mode === 'Register' ? WebAuthnMode.Register : WebAuthnMode.Login,
    })

    // Client for the Circle modular (bundler + paymaster) services
    const modularClient = viem.createClient({
      chain: chainConfig.chain,
      transport: modularTransport,
    })

    const smartAccount = await toCircleSmartAccount({
      client: modularClient,
      owner: credential as any, // WebAuthnAccount shape
      name: username,
    })

    // Bundler client that sends UserOperations for this smart account
    const bundlerClient = aa.createBundlerClient({
      account: smartAccount,
      chain: chainConfig.chain,
      transport: modularTransport,
    })

    return { credential, smartAccount, bundlerClient }
  }, [clientUrl, clientKey, chainConfig])

  const loginPasskey = React.useCallback(async (username?: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const effectiveUsername = username || `autopay-${Date.now()}`
      const { credential, smartAccount, bundlerClient } = await createSmartAccount(
        'Register',
        effectiveUsername,
      )

      // Persist credentialId so the user can reconnect without re-registering
      const credentialId = (credential as any).id
      if (credentialId) {
        localStorage.setItem(CREDENTIAL_KEY, credentialId)
        localStorage.setItem(USERNAME_KEY, effectiveUsername)
      }

      setAddress(smartAccount.address as `0x${string}`)
      setWalletClient(bundlerClient)
      smartAccountRef.current = smartAccount
      setWalletMode('passkey')
    } catch (err) {
      console.error('[Arc] Passkey registration failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to create passkey')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [createSmartAccount])

  const connectPasskey = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const credentialId = localStorage.getItem(CREDENTIAL_KEY) || undefined
      const username = localStorage.getItem(USERNAME_KEY) || undefined
      const { smartAccount, bundlerClient } = await createSmartAccount(
        'Login',
        username,
        credentialId,
      )
      setAddress(smartAccount.address as `0x${string}`)
      setWalletClient(bundlerClient)
      smartAccountRef.current = smartAccount
      setWalletMode('passkey')
    } catch (err) {
      console.error('[Arc] Passkey login failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to login with passkey')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [createSmartAccount])

  const disconnectPasskey = React.useCallback(() => {
    setAddress(null)
    setWalletClient(null)
    smartAccountRef.current = null
    setWalletMode(null)
    // Note: we DON'T delete the credentialId — the passkey still exists in the
    // user's OS keychain. Clearing it would force them to re-register.
  }, [])

  const selectWagmi = React.useCallback(() => {
    setWalletMode('wagmi')
  }, [])

  const signMessage = React.useCallback(async (message: string): Promise<string> => {
    const account = smartAccountRef.current
    if (!account) throw new Error('Arc passkey not active')
    // viem SmartAccount exposes signMessage — for ERC-4337 this produces an
    // EIP-1271 contract signature that external verifiers can validate.
    const sig = await account.signMessage({ message })
    return sig
  }, [])

  const value = React.useMemo<ArcWalletState>(() => ({
    address,
    publicClient,
    walletClient,
    isConnected: walletMode === 'passkey' && !!address,
    isReady: true,
    walletMode,
    isPasskeyMode: walletMode === 'passkey' && !!address,
    loginPasskey,
    connectPasskey,
    disconnectPasskey,
    selectWagmi,
    signMessage,
    isLoading,
    error,
  }), [address, publicClient, walletClient, walletMode, loginPasskey, connectPasskey, disconnectPasskey, selectWagmi, signMessage, isLoading, error])

  return (
    <ArcWalletContext.Provider value={value}>
      {children}
    </ArcWalletContext.Provider>
  )
}

function ArcWalletNoop({ children }: { children: React.ReactNode }) {
  return (
    <ArcWalletContext.Provider value={defaultState}>
      {children}
    </ArcWalletContext.Provider>
  )
}

export function ArcWalletProvider({ children }: { children: React.ReactNode }) {
  const isArc = DEFAULT_CHAIN === 'arcTestnet'
  if (!isArc) return <ArcWalletNoop>{children}</ArcWalletNoop>
  return <ArcWalletInner>{children}</ArcWalletInner>
}

export function useArcWallet() {
  return React.useContext(ArcWalletContext)
}

export function isArcBuild(): boolean {
  return DEFAULT_CHAIN === 'arcTestnet'
}
