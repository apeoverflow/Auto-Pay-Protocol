import { ConnectButton } from '@rainbow-me/rainbowkit'

export function ConnectWallet() {
  return (
    <div className="auth-passkey-layout">
      <ConnectButton.Custom>
        {({ openConnectModal, connectModalOpen }) => (
          <button
            onClick={openConnectModal}
            disabled={connectModalOpen}
            className="auth-connect-btn group"
          >
            <span className="auth-connect-btn-label">Connect Wallet</span>
            <svg className="h-4 w-4 opacity-70 group-hover:translate-x-0.5 transition-transform duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        )}
      </ConnectButton.Custom>
      <p className="auth-connect-hint">
        MetaMask, Coinbase, WalletConnect & more
      </p>
    </div>
  )
}
