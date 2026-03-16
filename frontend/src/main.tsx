import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import './index.css'
import { ChainProvider } from './contexts/ChainContext'
import { AuthProvider } from './contexts/AuthContext'
import { WalletProvider } from './contexts/WalletContext'
import { TermsProvider } from './contexts/TermsContext'
import { MerchantModeProvider } from './contexts/MerchantModeContext'
import { wagmiConfig } from './config/wagmi'
import { CHAIN_CONFIGS, DEFAULT_CHAIN } from './config/chains'
import App from './App'

const initialChain = CHAIN_CONFIGS[DEFAULT_CHAIN].chain

// Per-chain primary color (HSL values for --primary CSS variable)
const CHAIN_PRIMARY: Record<string, string> = {
  flowEvm: '155 100% 35%',      // #00B46C green
  base: '221.2 83.2% 53.3%',    // #3B82F6 blue (default)
  polkadotHub: '256 30% 28%',   // dark purple/slate
}
const chainPrimary = CHAIN_PRIMARY[DEFAULT_CHAIN]
if (chainPrimary) {
  const s = document.createElement('style')
  s.textContent = `:root { --primary: ${chainPrimary} !important; }`
  document.head.appendChild(s)
}

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={initialChain} theme={darkTheme({ accentColor: '#0000FF', borderRadius: 'large' })}>
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
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
