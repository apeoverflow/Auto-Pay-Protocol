import { createConfig, http } from 'wagmi'
import {
  sepolia,
  baseSepolia,
  polygonAmoy,
  arbitrumSepolia,
  avalancheFuji,
  sonicTestnet,
  worldchainSepolia,
  seiTestnet,
} from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { hyperEvmTestnet } from './gateway'

// Configure wagmi for browser wallet connections (MetaMask, etc.)
// Used for cross-chain transfers to fund the Modular Wallet on Arc
export const wagmiConfig = createConfig({
  chains: [
    sepolia,
    avalancheFuji,
    baseSepolia,
    sonicTestnet,
    worldchainSepolia,
    seiTestnet,
    hyperEvmTestnet,
    polygonAmoy,
    arbitrumSepolia,
  ],
  connectors: [
    injected(), // MetaMask, Coinbase Wallet, etc.
    walletConnect({
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
    }),
  ],
  transports: {
    [sepolia.id]: http(),
    [avalancheFuji.id]: http(),
    [baseSepolia.id]: http(),
    [sonicTestnet.id]: http(),
    [worldchainSepolia.id]: http(),
    [seiTestnet.id]: http(),
    [hyperEvmTestnet.id]: http(),
    [polygonAmoy.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
})

// Chain ID to wagmi chain mapping for easy lookup
export const WAGMI_CHAINS = {
  [sepolia.id]: sepolia,
  [avalancheFuji.id]: avalancheFuji,
  [baseSepolia.id]: baseSepolia,
  [sonicTestnet.id]: sonicTestnet,
  [worldchainSepolia.id]: worldchainSepolia,
  [seiTestnet.id]: seiTestnet,
  [hyperEvmTestnet.id]: hyperEvmTestnet,
  [polygonAmoy.id]: polygonAmoy,
  [arbitrumSepolia.id]: arbitrumSepolia,
} as const
