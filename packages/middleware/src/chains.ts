export type ChainKey = 'flowEvm' | 'base' | 'baseSepolia'

export interface MiddlewareChainConfig {
  name: string
  chainId: number
  rpcUrl: string
  policyManager: `0x${string}`
  usdc: `0x${string}`
}

export const chains: Record<ChainKey, MiddlewareChainConfig> = {
  flowEvm: {
    name: 'Flow EVM',
    chainId: 747,
    rpcUrl: 'https://mainnet.evm.nodes.onflow.org',
    policyManager: '0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345',
    usdc: '0xF1815bd50389c46847f0Bda824eC8da914045D14',
  },
  base: {
    name: 'Base',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    policyManager: '0x037A24595E96B10d9FB2c7c2668FE5e7F354c86a',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  baseSepolia: {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    policyManager: '0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
}
