import * as React from 'react'
import { useAccount, useDisconnect } from 'wagmi'

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
  const { isConnected, address } = useAccount()
  const { disconnect } = useDisconnect()

  const value = React.useMemo(
    () => ({
      isLoggedIn: isConnected,
      username: address ? shortenAddress(address) : '',
      logout: () => disconnect(),
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
