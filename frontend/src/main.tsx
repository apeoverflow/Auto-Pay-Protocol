import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import './index.css'
import { ChainProvider } from './contexts/ChainContext'
import { AuthProvider } from './contexts/AuthContext'
import { WalletProvider } from './contexts/WalletContext'
import App from './App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ChainProvider>
      <AuthProvider>
        <WalletProvider>
          <App />
        </WalletProvider>
      </AuthProvider>
    </ChainProvider>
  </React.StrictMode>,
)
