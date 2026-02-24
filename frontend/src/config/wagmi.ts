import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
  rabbyWallet,
  phantomWallet,
  injectedWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { createConfig, http } from 'wagmi'
import { mainnet, arbitrum, optimism, base, polygon, bsc, avalanche, gnosis } from 'wagmi/chains'
import { CHAIN_CONFIGS } from './chains'

// All AutoPay chains (mainnet + testnet) from the generated config
const autoPayChains = Object.values(CHAIN_CONFIGS).map(c => c.chain)

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [
        metaMaskWallet,
        coinbaseWallet,
        rabbyWallet,
        phantomWallet,
        walletConnectWallet,
      ],
    },
    {
      groupName: 'Other',
      wallets: [injectedWallet],
    },
  ],
  { appName: 'AutoPay Protocol', projectId },
)

export const wagmiConfig = createConfig({
  connectors,
  chains: [...autoPayChains, mainnet, arbitrum, optimism, base, polygon, bsc, avalanche, gnosis] as any,
  transports: Object.fromEntries(
    [...autoPayChains, mainnet, arbitrum, optimism, base, polygon, bsc, avalanche, gnosis].map(c => [c.id, http()])
  ),
})
