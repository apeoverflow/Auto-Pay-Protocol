import { BridgeChain } from '@circle-fin/bridge-kit'

// Supported source chains for funding the Modular Wallet on Arc
// These are testnets where users might have USDC in their browser wallet (MetaMask, etc.)
export const BRIDGE_SOURCE_CHAINS = [
  {
    id: BridgeChain.Ethereum_Sepolia,
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    shortName: 'Sepolia',
  },
  {
    id: BridgeChain.Base_Sepolia,
    name: 'Base Sepolia',
    chainId: 84532,
    shortName: 'Base',
  },
  {
    id: BridgeChain.Polygon_Amoy_Testnet,
    name: 'Polygon Amoy',
    chainId: 80002,
    shortName: 'Polygon',
  },
  {
    id: BridgeChain.Arbitrum_Sepolia,
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    shortName: 'Arbitrum',
  },
] as const

export type BridgeSourceChain = typeof BRIDGE_SOURCE_CHAINS[number]
export type BridgeSourceChainId = BridgeSourceChain['id']

// Arc Testnet is always the destination for Bridge Kit transfers
export const BRIDGE_DESTINATION_CHAIN = BridgeChain.Arc_Testnet

// USDC addresses for source chains (for balance display)
export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Ethereum Sepolia
  84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia
  80002: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // Polygon Amoy
  421614: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia
}

// Get chain config by chainId
export function getSourceChainByChainId(chainId: number): BridgeSourceChain | undefined {
  return BRIDGE_SOURCE_CHAINS.find(chain => chain.chainId === chainId)
}
