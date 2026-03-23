import * as React from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { isTempoBuild, useTempoWallet } from './TempoWalletContext'

interface AuthContextValue {
  isLoggedIn: boolean
  username: string
  logout: () => void
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isConnected: wagmiConnected, address: wagmiAddress } = useAccount()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const tempoWallet = useTempoWallet()
  const isTempo = isTempoBuild()

  // For Tempo builds, use Privy wallet state; otherwise use wagmi
  const isConnected = isTempo ? tempoWallet.isConnected : wagmiConnected
  const address = isTempo ? tempoWallet.address : wagmiAddress
  const disconnect = isTempo ? tempoWallet.logout : () => wagmiDisconnect()

  const value = React.useMemo(
    () => ({
      isLoggedIn: isConnected,
      username: address ? shortenAddress(address) : '',
      logout: disconnect,
    }),
    [isConnected, address, disconnect]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
