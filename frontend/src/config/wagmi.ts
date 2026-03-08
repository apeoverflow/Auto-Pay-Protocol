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
import {
  mainnet, arbitrum, optimism, base, polygon, bsc, avalanche, gnosis,
  zkSync, linea, scroll, blast, mantle, celo, moonbeam, metis, boba,
  cronos, mode, ronin, sei, sonic, flare, telos, lisk,
} from 'wagmi/chains'
import { defineChain } from 'viem'
import { CHAIN_CONFIGS } from './chains'

// All AutoPay chains (mainnet + testnet) from the generated config
const autoPayChains = Object.values(CHAIN_CONFIGS).map(c => c.chain)
const autoPayChainIds = new Set<number>(autoPayChains.map(c => c.id))

// Chains with first-class wagmi definitions
const wagmiChains = [
  mainnet, arbitrum, optimism, base, polygon, bsc, avalanche, gnosis,
  zkSync, linea, scroll, blast, mantle, celo, moonbeam, metis, boba,
  cronos, mode, ronin, sei, sonic, flare, telos, lisk,
].filter(c => !autoPayChainIds.has(c.id))

// Additional LiFi-supported EVM chains (minimal definitions for chain switching)
const lifiExtraChains = [
  { id: 130, name: 'Unichain' },
  { id: 143, name: 'Monad' },
  { id: 146, name: 'Sonic' },
  { id: 204, name: 'opBNB' },
  { id: 232, name: 'Lens' },
  { id: 252, name: 'Fraxtal' },
  { id: 288, name: 'Boba' },
  { id: 480, name: 'World Chain' },
  { id: 988, name: 'Stable' },
  { id: 999, name: 'HyperEVM' },
  { id: 1088, name: 'Metis' },
  { id: 1284, name: 'Moonbeam' },
  { id: 1329, name: 'Sei' },
  { id: 1337, name: 'Hyperliquid' },
  { id: 1480, name: 'Vana' },
  { id: 1625, name: 'Gravity' },
  { id: 1868, name: 'Soneium' },
  { id: 1923, name: 'Swellchain' },
  { id: 2020, name: 'Ronin' },
  { id: 2741, name: 'Abstract' },
  { id: 4326, name: 'MegaETH' },
  { id: 9745, name: 'Plasma' },
  { id: 13371, name: 'Immutable zkEVM' },
  { id: 21000000, name: 'Corn' },
  { id: 33139, name: 'Apechain' },
  { id: 34443, name: 'Mode' },
  { id: 42793, name: 'Etherlink' },
  { id: 43111, name: 'Hemi' },
  { id: 50104, name: 'Sophon' },
  { id: 55244, name: 'Superposition' },
  { id: 57073, name: 'Ink' },
  { id: 60808, name: 'BOB' },
  { id: 80094, name: 'Berachain' },
  { id: 98866, name: 'Plume' },
  { id: 122, name: 'Fuse' },
  { id: 167000, name: 'Taiko' },
  { id: 747474, name: 'Katana' },
]
  .filter(c => !autoPayChainIds.has(c.id))
  .filter(c => !wagmiChains.some(w => w.id === c.id))
  .map(c => defineChain({
    id: c.id,
    name: c.name,
    nativeCurrency: { decimals: 18, name: 'ETH', symbol: 'ETH' },
    rpcUrls: { default: { http: [] } },
  }))

const allChains = [...autoPayChains, ...wagmiChains, ...lifiExtraChains]

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
