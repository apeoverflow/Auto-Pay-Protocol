import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
/* RAINBOWKIT: commented out for wallet migration — restore if reverting
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
*/
import './index.css'
import { ChainProvider } from './contexts/ChainContext'
import { AuthProvider } from './contexts/AuthContext'
import { WalletProvider } from './contexts/WalletContext'
import { TermsProvider } from './contexts/TermsContext'
import { MerchantModeProvider } from './contexts/MerchantModeContext'
import { TempoWalletProvider, isTempoBuild } from './contexts/TempoWalletContext'
import { ConnectModalProvider } from './contexts/ConnectModalContext'
import { wagmiConfig } from './config/wagmi'
import { DEFAULT_CHAIN } from './config/chains'
import App from './App'

// Per-chain primary color (HSL values for --primary CSS variable)
const CHAIN_PRIMARY: Record<string, string> = {
  flowEvm: '155 100% 35%',      // #00B46C green
  base: '221.2 83.2% 53.3%',    // #3B82F6 blue (default)
  polkadotHub: '256 30% 28%',   // dark purple/slate
  tempo: '0 0% 10%',            // near-black
}
const chainPrimary = CHAIN_PRIMARY[DEFAULT_CHAIN]
if (chainPrimary) {
  const s = document.createElement('style')
  s.textContent = `:root { --primary: ${chainPrimary} !important; }`
  document.head.appendChild(s)
}

const queryClient = new QueryClient()
const isTempo = isTempoBuild()

// Privy provider — only imported and rendered on Tempo builds
const USDC_E = '0x20c000000000000000000000b9537d11c60e8b50'

const PrivyWrapper = isTempo
  ? React.lazy(() =>
      Promise.all([
        import('@privy-io/react-auth'),
        import('viem/chains'),
      ]).then(([mod, chains]) => ({
        default: ({ children }: { children: React.ReactNode }) => {
          const appId = import.meta.env.VITE_PRIVY_APP_ID
          if (!appId) {
            console.error('VITE_PRIVY_APP_ID not set — Privy disabled')
            return <>{children}</>
          }
          // Use viem's native Tempo chain with feeToken — required for gas sponsorship
          const tempoChain = chains.tempo.extend({ feeToken: USDC_E })
          return (
            <mod.PrivyProvider
              appId={appId}
              config={{
                // No 'wallet' — external wallets (MetaMask/Rabby) can't sign Tempo transactions.
                // Users must use embedded wallets via email/Google for gas sponsorship to work.
                loginMethods: ['email', 'google'],
                defaultChain: tempoChain,
                supportedChains: [tempoChain],
                appearance: {
                  theme: 'dark',
                  accentColor: '#1A1A1A',
                },
                // NO client-side wallet creation — wallets are created server-side
                // via the relayer's /api/tempo/create-wallet endpoint
                embeddedWallets: {
                  ethereum: { createOnLogin: 'off' },
                  showWalletUIs: false,
                },
              }}
            >
              {children}
            </mod.PrivyProvider>
          )
        },
      }))
    )
  : ({ children }: { children: React.ReactNode }) => <>{children}</>

const AppTree = (
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <React.Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>}>
        <PrivyWrapper>
          <TempoWalletProvider>
            <ConnectModalProvider>
              <ChainProvider>
                <AuthProvider>
                  <WalletProvider>
                    <TermsProvider>
                      <MerchantModeProvider>
                        <App />
                      </MerchantModeProvider>
                    </TermsProvider>
                  </WalletProvider>
                </AuthProvider>
              </ChainProvider>
            </ConnectModalProvider>
          </TempoWalletProvider>
        </PrivyWrapper>
      </React.Suspense>
    </QueryClientProvider>
  </WagmiProvider>
)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {AppTree}
  </React.StrictMode>,
)
