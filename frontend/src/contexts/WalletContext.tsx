import * as React from 'react'
import { formatUnits } from 'viem'
import { toWebAuthnAccount, type SmartAccount, type WebAuthnAccount } from 'viem/account-abstraction'
import { toCircleSmartAccount } from '@circle-fin/modular-wallets-core'
import { publicClient, bundlerClient } from '../lib/clients'
import { USDC_ADDRESS, USDC_DECIMALS } from '../config'
import { erc20Abi } from '../config/contracts'
import { useAuth } from './AuthContext'

interface WalletContextValue {
  account: SmartAccount | undefined
  balance: string | null
  isLoading: boolean
  fetchBalance: () => Promise<void>
}

const WalletContext = React.createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { credential, username, logout } = useAuth()
  const [account, setAccount] = React.useState<SmartAccount>()
  const [balance, setBalance] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  // Fetch balance function
  const fetchBalance = React.useCallback(async () => {
    if (!publicClient || !account?.address) return

    try {
      const rawBalance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address],
      })
      setBalance(formatUnits(rawBalance, USDC_DECIMALS))
    } catch (err) {
      console.error('Failed to fetch balance:', err)
      setBalance(null)
    }
  }, [account?.address])

  // Create smart account from passkey credential
  React.useEffect(() => {
    if (!credential || !publicClient) return

    setIsLoading(true)
    toCircleSmartAccount({
      client: publicClient,
      owner: toWebAuthnAccount({ credential }) as WebAuthnAccount,
      name: username,
    })
      .then(setAccount)
      .catch((err) => {
        console.error('Failed to create smart account:', err)
        // Credential is stale or invalid — force logout so user can re-authenticate
        logout()
      })
      .finally(() => setIsLoading(false))
  }, [credential, username, logout])

  // Fetch balance when account changes
  React.useEffect(() => {
    if (account?.address) {
      fetchBalance()
    }
  }, [account?.address, fetchBalance])

  // Clear account on logout
  React.useEffect(() => {
    if (!credential) {
      setAccount(undefined)
      setBalance(null)
    }
  }, [credential])

  const value = React.useMemo(
    () => ({
      account,
      balance,
      isLoading,
      fetchBalance,
    }),
    [account, balance, isLoading, fetchBalance]
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const context = React.useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}

// Re-export bundlerClient for use in hooks
export { bundlerClient }
