import { ContractAddress } from '@circle-fin/modular-wallets-core'

// Environment variables
export const clientKey = import.meta.env.VITE_CLIENT_KEY as string | undefined
export const clientUrl = import.meta.env.VITE_CLIENT_URL as string | undefined

// Feature flags
export const isConfigured = Boolean(clientKey && clientUrl)

// USDC Configuration
export const USDC_DECIMALS = 6
export const USDC_ADDRESS = ContractAddress.PolygonAmoy_USDC

// Network Configuration
export const CHAIN_ID = 80002 // Polygon Amoy
export const CHAIN_NAME = 'Polygon Amoy'
export const BLOCK_EXPLORER_URL = 'https://amoy.polygonscan.com'

// LocalStorage Keys
export const STORAGE_KEYS = {
  CREDENTIAL: 'credential',
  USERNAME: 'username',
  AUTH_METHOD: 'authMethod',
  HAS_RECOVERY_KEY: 'hasRecoveryKey',
} as const
