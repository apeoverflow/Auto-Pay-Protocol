import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { ChainProvider } from './contexts/ChainContext'
import { AuthProvider } from './contexts/AuthContext'
import { WalletProvider } from './contexts/WalletContext'
import { wagmiConfig } from './config/wagmi'
import App from './App'

// Create a React Query client for wagmi
const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ChainProvider>
          <AuthProvider>
            <WalletProvider>
              <App />
            </WalletProvider>
          </AuthProvider>
        </ChainProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
