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
const autoPayChainIds = new Set<number>(autoPayChains.map(c => c.id))

// Bridge source chains — exclude any already in autoPayChains to avoid duplicate keys
const bridgeChains = [mainnet, arbitrum, optimism, base, polygon, bsc, avalanche, gnosis]
  .filter(c => !autoPayChainIds.has(c.id))

const allChains = [...autoPayChains, ...bridgeChains]

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
  chains: allChains as any,
  transports: Object.fromEntries(allChains.map(c => [c.id, http()])),
})
