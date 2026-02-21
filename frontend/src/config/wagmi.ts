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
import { flowEvmMainnet } from './chains'

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
  chains: [flowEvmMainnet, mainnet, arbitrum, optimism, base, polygon, bsc, avalanche, gnosis],
  transports: {
    [flowEvmMainnet.id]: http(),
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
    [avalanche.id]: http(),
    [gnosis.id]: http(),
  },
})
