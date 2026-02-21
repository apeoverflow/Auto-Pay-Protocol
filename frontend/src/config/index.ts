// Feature flags
export const isConfigured = true

// USDC Configuration (same across all chains)
export const USDC_DECIMALS = 6

// LocalStorage Keys
export const STORAGE_KEYS = {
  USERNAME: 'username',
} as const

// Re-export chain configurations
export * from './chains'
export * from './deployments'
