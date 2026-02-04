// CCTP (Cross-Chain Transfer Protocol) configuration for direct transfers
// Used to bypass Bridge Kit and transfer USDC directly via CCTP

// TokenMessengerV2 address - same on all EVM chains
export const TOKEN_MESSENGER_V2 = '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as const

// CCTP Domain IDs
export const CCTP_DOMAINS: Record<number, number> = {
  11155111: 0, // Ethereum Sepolia
  84532: 6,    // Base Sepolia
  80002: 7,    // Polygon Amoy
  421614: 3,   // Arbitrum Sepolia
}

// Arc Testnet domain
export const ARC_DOMAIN = 26

// USDC addresses per chain
export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Ethereum Sepolia
  84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',    // Base Sepolia
  80002: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',    // Polygon Amoy
  421614: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',   // Arbitrum Sepolia
}

// TokenMessengerV2 ABI - only the functions we need
export const TOKEN_MESSENGER_V2_ABI = [
  {
    name: 'depositForBurn',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'minFinalityThreshold', type: 'uint32' },
    ],
    outputs: [{ name: 'nonce', type: 'uint64' }],
  },
] as const

// ERC20 approve ABI
export const ERC20_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// Convert an address to bytes32 (for CCTP mintRecipient)
export function addressToBytes32(address: string): `0x${string}` {
  // Remove 0x prefix, pad to 64 chars (32 bytes), add 0x back
  const cleanAddress = address.toLowerCase().replace('0x', '')
  return `0x${cleanAddress.padStart(64, '0')}`
}

// Chain configs for UI
export const BRIDGE_SOURCE_CHAINS = [
  { chainId: 11155111, name: 'Ethereum Sepolia', shortName: 'Sepolia' },
  { chainId: 84532, name: 'Base Sepolia', shortName: 'Base' },
  { chainId: 80002, name: 'Polygon Amoy', shortName: 'Polygon' },
  { chainId: 421614, name: 'Arbitrum Sepolia', shortName: 'Arbitrum' },
] as const

export type BridgeSourceChain = typeof BRIDGE_SOURCE_CHAINS[number]

export function getSourceChainByChainId(chainId: number): BridgeSourceChain | undefined {
  return BRIDGE_SOURCE_CHAINS.find(chain => chain.chainId === chainId)
}
