import { defineChain, type Chain } from 'viem'
import { DEPLOYMENTS } from './deployments'

// Flow EVM Mainnet chain definition
export const flowEvmMainnet = defineChain({
  id: 747,
  name: 'Flow EVM',
  nativeCurrency: { decimals: 18, name: 'FLOW', symbol: 'FLOW' },
  rpcUrls: { default: { http: ['https://mainnet.evm.nodes.onflow.org'] } },
  blockExplorers: { default: { name: 'Flowscan', url: 'https://evm.flowscan.io' } },
})

export interface ChainConfig {
  key: string
  chain: Chain
  name: string
  shortName: string
  usdc: `0x${string}`
  policyManager?: `0x${string}`
  deployBlock?: number
  explorer: string
  enabled: boolean
}

export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  flowEvm: {
    key: 'flowEvm',
    chain: flowEvmMainnet,
    name: 'Flow EVM',
    shortName: 'Flow',
    usdc: '0xF1815bd50389c46847f0Bda824eC8da914045D14',
    policyManager: DEPLOYMENTS[747]?.contracts.policyManager as `0x${string}` | undefined,
    deployBlock: DEPLOYMENTS[747]?.deployBlock,
    explorer: 'https://evm.flowscan.io',
    enabled: true,
  },
}

export const ENABLED_CHAINS = Object.values(CHAIN_CONFIGS).filter(c => c.enabled)
export const DEFAULT_CHAIN = 'flowEvm'
export type ChainKey = keyof typeof CHAIN_CONFIGS
