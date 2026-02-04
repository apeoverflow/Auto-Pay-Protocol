import { createConfig, http } from 'wagmi'
import { sepolia, baseSepolia, polygonAmoy, arbitrumSepolia } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

// Configure wagmi for browser wallet connections (MetaMask, etc.)
// Used for cross-chain transfers to fund the Modular Wallet on Arc
export const wagmiConfig = createConfig({
  chains: [sepolia, baseSepolia, polygonAmoy, arbitrumSepolia],
  connectors: [
    injected(), // MetaMask, Coinbase Wallet, etc.
    walletConnect({
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
    }),
  ],
  transports: {
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
    [polygonAmoy.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
})

// Chain ID to wagmi chain mapping for easy lookup
export const WAGMI_CHAINS = {
  [sepolia.id]: sepolia,
  [baseSepolia.id]: baseSepolia,
  [polygonAmoy.id]: polygonAmoy,
  [arbitrumSepolia.id]: arbitrumSepolia,
} as const
