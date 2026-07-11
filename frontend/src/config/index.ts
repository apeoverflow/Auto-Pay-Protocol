// Feature flags
export const isConfigured = true

// USDC Configuration (same across all chains)
export const USDC_DECIMALS = 6

// An ERC20 allowance at or above this is treated as "unlimited" — far beyond
// any realistic committed amount in 6-decimal USDC, while well below
// maxUint128 (the sentinel used on Polkadot Hub) and maxUint256 elsewhere.
export const UNLIMITED_APPROVAL_THRESHOLD = 10n ** 30n

// LocalStorage Keys
export const STORAGE_KEYS = {
  USERNAME: 'username',
} as const

// Re-export chain configurations
export * from './chains'
export * from './deployments'
