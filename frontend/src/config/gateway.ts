// Circle Gateway configuration for cross-chain USDC transfers
// Gateway enables instant (~500ms) transfers via EIP-712 signatures

import { arcTestnet, baseSepolia, sepolia } from 'viem/chains'
import type { Chain, Hex } from 'viem'

export const GATEWAY_API_URL = 'https://gateway-api-testnet.circle.com/v1'

// Network configuration for each chain
export interface NetworkConfig {
  RPC: string
  GatewayWallet: Hex
  GatewayMinter: Hex
  USDCAddress: Hex
  ViemChain: Chain
}

export interface ChainConfig {
  domain: number
  name: string
  shortName: string
  testnet: NetworkConfig
}

// Ethereum Sepolia
export const ethereumSepoliaConfig: ChainConfig = {
  domain: 0,
  name: 'Ethereum Sepolia',
  shortName: 'Sepolia',
  testnet: {
    RPC: 'https://ethereum-sepolia-rpc.publicnode.com',
    GatewayWallet: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
    GatewayMinter: '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B',
    USDCAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    ViemChain: sepolia,
  },
}

// Base Sepolia
export const baseSepoliaConfig: ChainConfig = {
  domain: 6,
  name: 'Base Sepolia',
  shortName: 'Base',
  testnet: {
    RPC: 'https://base-sepolia-rpc.publicnode.com',
    GatewayWallet: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
    GatewayMinter: '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B',
    USDCAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    ViemChain: baseSepolia,
  },
}

// Arc Testnet (destination)
export const arcTestnetConfig: ChainConfig = {
  domain: 26,
  name: 'Arc Testnet',
  shortName: 'Arc',
  testnet: {
    RPC: 'https://rpc.testnet.arc.network',
    GatewayWallet: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
    GatewayMinter: '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B',
    USDCAddress: '0x3600000000000000000000000000000000000000',
    ViemChain: arcTestnet,
  },
}

// Supported source chains for funding (testnets)
export const GATEWAY_SOURCE_CHAINS = [
  ethereumSepoliaConfig,
  baseSepoliaConfig,
] as const

export type GatewaySourceChain = typeof GATEWAY_SOURCE_CHAINS[number]

// Get chain config by chainId
export function getSourceChainByChainId(chainId: number): GatewaySourceChain | undefined {
  return GATEWAY_SOURCE_CHAINS.find(chain => chain.testnet.ViemChain.id === chainId)
}

// USDC addresses by chainId for balance lookups
export const USDC_ADDRESSES: Record<number, Hex> = {
  [sepolia.id]: ethereumSepoliaConfig.testnet.USDCAddress,
  [baseSepolia.id]: baseSepoliaConfig.testnet.USDCAddress,
}

// EIP-712 Domain for Gateway signing
export const EIP712_DOMAIN = {
  name: 'GatewayWallet',
  version: '1',
} as const

// EIP-712 Type definitions for burn intent signing
export const EIP712_TYPES = {
  TransferSpec: [
    { name: 'version', type: 'uint32' },
    { name: 'sourceDomain', type: 'uint32' },
    { name: 'destinationDomain', type: 'uint32' },
    { name: 'sourceContract', type: 'bytes32' },
    { name: 'destinationContract', type: 'bytes32' },
    { name: 'sourceToken', type: 'bytes32' },
    { name: 'destinationToken', type: 'bytes32' },
    { name: 'sourceDepositor', type: 'bytes32' },
    { name: 'destinationRecipient', type: 'bytes32' },
    { name: 'sourceSigner', type: 'bytes32' },
    { name: 'destinationCaller', type: 'bytes32' },
    { name: 'value', type: 'uint256' },
    { name: 'salt', type: 'bytes32' },
    { name: 'hookData', type: 'bytes' },
  ],
  BurnIntent: [
    { name: 'maxBlockHeight', type: 'uint256' },
    { name: 'maxFee', type: 'uint256' },
    { name: 'spec', type: 'TransferSpec' },
  ],
} as const

// Gateway Minter ABI - for calling gatewayMint on destination
export const GATEWAY_MINTER_ABI = [
  {
    type: 'function',
    name: 'gatewayMint',
    inputs: [
      { name: 'attestationPayload', type: 'bytes' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

// Gateway Wallet ABI - for depositing USDC on source chain
export const GATEWAY_WALLET_ABI = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

// ERC20 ABI for approve/allowance/balanceOf
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

// Helper: Convert address to bytes32
export function addressToBytes32(address: Hex): Hex {
  const clean = address.toLowerCase().replace('0x', '')
  return `0x${clean.padStart(64, '0')}` as Hex
}

// Helper: Generate random 32-byte salt
export function randomSalt(): Hex {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as Hex
}
