import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useConnect } from 'wagmi'
import { isTempoBuild, useTempoWallet } from './TempoWalletContext'
import { isArcBuild, useArcWallet } from './ArcWalletContext'

interface ConnectModalContextValue {
  isOpen: boolean
  openConnectModal: () => void
  closeConnectModal: () => void
}

const ConnectModalContext = createContext<ConnectModalContextValue>({
  isOpen: false,
  openConnectModal: () => {},
  closeConnectModal: () => {},
})

export const useConnectModal = () => useContext(ConnectModalContext)

export function ConnectModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const { connectors, connect } = useConnect()
  const tempoWallet = useTempoWallet()
  const arcWallet = useArcWallet()
  const isTempo = isTempoBuild()
  const isArc = isArcBuild()

  // Arc passkey UX state
  const [arcUsername, setArcUsername] = useState('')
  const [arcError, setArcError] = useState<string | null>(null)
  const [arcBusy, setArcBusy] = useState<'register' | 'login' | null>(null)

  const openConnectModal = useCallback(() => {
    if (isTempo) {
      if (!tempoWallet.isConnected) {
        tempoWallet.login()
      }
    } else {
      setIsOpen(true)
    }
  }, [isTempo, tempoWallet])

  const closeConnectModal = useCallback(() => {
    setIsOpen(false)
    setArcError(null)
    setArcBusy(null)
  }, [])

  const handleConnect = useCallback((connector: typeof connectors[number]) => {
    // On Arc, flag that the user picked the browser wallet path so ChainContext
    // falls through to wagmi instead of looking at ArcWallet.
    if (isArc) arcWallet.selectWagmi()
    connect({ connector })
    setIsOpen(false)
  }, [connect, isArc, arcWallet])

  const handlePasskeyRegister = useCallback(async () => {
    setArcError(null)
    setArcBusy('register')
    try {
      await arcWallet.loginPasskey(arcUsername || undefined)
      setIsOpen(false)
    } catch (err) {
      setArcError(err instanceof Error ? err.message : 'Failed to register passkey')
    } finally {
      setArcBusy(null)
    }
  }, [arcWallet, arcUsername])

  const handlePasskeyLogin = useCallback(async () => {
    setArcError(null)
    setArcBusy('login')
    try {
      await arcWallet.connectPasskey()
      setIsOpen(false)
    } catch (err) {
      setArcError(err instanceof Error ? err.message : 'Failed to login with passkey')
    } finally {
      setArcBusy(null)
    }
  }, [arcWallet])

  const hasExistingPasskey = typeof window !== 'undefined' && !!localStorage.getItem('autopay-arc-passkey-credential-id')

  return (
    <ConnectModalContext.Provider value={{ isOpen, openConnectModal, closeConnectModal }}>
      {children}

      {isOpen && !isTempo && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={closeConnectModal}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm px-4">
            <div className="bg-popover border border-border rounded-2xl shadow-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold">Connect Wallet</h2>
                <button
                  onClick={closeConnectModal}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>

              {/* Arc-specific: show passkey option above browser wallet */}
              {isArc && (
                <div className="mb-5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Passkey Wallet
                  </div>
                  <div className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-background/50">
                    {!hasExistingPasskey && (
                      <input
                        type="text"
                        placeholder="Username (optional)"
                        value={arcUsername}
                        onChange={(e) => setArcUsername(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    )}
                    <div className="flex gap-2">
                      {hasExistingPasskey && (
                        <button
                          onClick={handlePasskeyLogin}
                          disabled={!!arcBusy}
                          className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          {arcBusy === 'login' ? 'Signing in…' : 'Sign in with Passkey'}
                        </button>
                      )}
                      <button
                        onClick={handlePasskeyRegister}
                        disabled={!!arcBusy}
                        className={`${hasExistingPasskey ? 'flex-1' : 'w-full'} px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted/50 disabled:opacity-50 transition-colors`}
                      >
                        {arcBusy === 'register' ? 'Creating…' : hasExistingPasskey ? 'Create new' : 'Create Passkey Wallet'}
                      </button>
                    </div>
                    {arcError && (
                      <div className="text-xs text-red-500 mt-1">{arcError}</div>
                    )}
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Uses your device's biometrics (Touch ID / Face ID / Windows Hello). Creates a Circle smart account — no seed phrase.
                    </p>
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-5 mb-2">
                    Or use a Browser Wallet
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {connectors.map((connector) => (
                  <button
                    key={connector.uid}
                    onClick={() => handleConnect(connector)}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors text-left"
                  >
                    {connector.icon && (
                      <img src={connector.icon} alt="" className="h-8 w-8 rounded-lg" />
                    )}
                    <span className="text-sm font-medium flex-1">{connector.name}</span>
                    <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                    </svg>
                  </button>
                ))}
                <p className="text-xs text-muted-foreground text-center mt-3">
                  MetaMask, Coinbase, WalletConnect & more
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </ConnectModalContext.Provider>
  )
}
