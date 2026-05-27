import * as React from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { isTempoBuild, useTempoWallet } from './TempoWalletContext'
import { isArcBuild, useArcWallet } from './ArcWalletContext'

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
  const arcWallet = useArcWallet()
  const isTempo = isTempoBuild()
  const isArc = isArcBuild()
  const isArcPasskey = isArc && arcWallet.isPasskeyMode

  // Choose connection state based on active wallet mode:
  //  - Tempo: Privy session
  //  - Arc passkey: Circle smart account session
  //  - Arc wagmi: wagmi only if the user explicitly chose browser wallet
  //    (prevents Phantom auto-reconnect from sneaking past the wallet picker)
  //  - Everything else: wagmi
  const isArcWagmi = isArc && arcWallet.walletMode === 'wagmi'
  const isConnected = isTempo
    ? tempoWallet.isConnected
    : isArcPasskey
      ? arcWallet.isConnected
      : isArc
        ? isArcWagmi && wagmiConnected
        : wagmiConnected
  const address = isTempo
    ? tempoWallet.address
    : isArcPasskey
      ? arcWallet.address
      : wagmiAddress
  const disconnect = isTempo
    ? tempoWallet.logout
    : isArcPasskey
      ? arcWallet.disconnectPasskey
      : () => {
          // On Arc wagmi mode, also clear the mode so next connect shows the picker
          if (isArc) arcWallet.disconnectPasskey()
          wagmiDisconnect()
        }

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
