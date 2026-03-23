import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useConnect } from 'wagmi'
import { isTempoBuild, useTempoWallet } from './TempoWalletContext'

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
  const isTempo = isTempoBuild()

  const openConnectModal = useCallback(() => {
    if (isTempo) {
      // On Tempo, delegate to Privy's login modal
      // If already connected OR if Privy is authenticated but wallet creation
      // failed (isReady but no wallet), don't call login again — it would
      // trigger a "user is already logged in" warning from Privy.
      if (!tempoWallet.isConnected) {
        tempoWallet.login()
      }
    } else {
      // On other chains, show our custom connect modal
      setIsOpen(true)
    }
  }, [isTempo, tempoWallet])

  const closeConnectModal = useCallback(() => setIsOpen(false), [])

  const handleConnect = useCallback((connector: typeof connectors[number]) => {
    connect({ connector })
    setIsOpen(false)
  }, [connect])

  return (
    <ConnectModalContext.Provider value={{ isOpen, openConnectModal, closeConnectModal }}>
      {children}

      {/* Connect modal — only shown for non-Tempo chains */}
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
