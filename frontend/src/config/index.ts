// Environment variables
export const clientKey = import.meta.env.VITE_CLIENT_KEY as string | undefined
export const clientUrl = import.meta.env.VITE_CLIENT_URL as string | undefined

// Feature flags
export const isConfigured = Boolean(clientKey && clientUrl)

// USDC Configuration (same across all chains)
export const USDC_DECIMALS = 6

// LocalStorage Keys
export const STORAGE_KEYS = {
  CREDENTIAL: 'credential',
  USERNAME: 'username',
  AUTH_METHOD: 'authMethod',
  HAS_RECOVERY_KEY: 'hasRecoveryKey',
} as const

// Re-export chain configurations
export * from './chains'
export * from './deployments'
