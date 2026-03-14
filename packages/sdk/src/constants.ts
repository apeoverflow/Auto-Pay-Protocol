// ---------------------------------------------------------------------------
// Intervals (seconds)
// ---------------------------------------------------------------------------

export const intervals = {
  /** 1 second — useful for testing */
  seconds: 1,
  /** 1 minute — useful for testing */
  minutes: 60,
  /** Alias for minutes */
  minute: 60,
  /** 1 day */
  daily: 86_400,
  /** 7 days */
  weekly: 604_800,
  /** 14 days */
  biweekly: 1_209_600,
  /** 30 days */
  monthly: 2_592_000,
  /** 90 days */
  quarterly: 7_776_000,
  /** 365 days */
  yearly: 31_536_000,

  /** Build a custom interval from a count and unit */
  custom(count: number, unit: 'minutes' | 'hours' | 'days' | 'months' | 'years'): number {
    const multipliers: Record<string, number> = {
      minutes: 60,
      hours: 3_600,
      days: 86_400,
      months: 2_592_000,  // 30 days
      years: 31_536_000,  // 365 days
    }
    return count * multipliers[unit]
  },
} as const

// ---------------------------------------------------------------------------
// Protocol
// ---------------------------------------------------------------------------

/** Protocol fee in basis points (2.5%) */
export const PROTOCOL_FEE_BPS = 250

/** USDC uses 6 decimals */
export const USDC_DECIMALS = 6

/** Minimum interval (1 minute) */
export const MIN_INTERVAL = 60

/** Maximum interval (365 days) */
export const MAX_INTERVAL = 31_536_000

/** Max consecutive failures before auto-cancel */
export const MAX_RETRIES = 3

// ---------------------------------------------------------------------------
// Chain configs
// ---------------------------------------------------------------------------

// --- AUTO-GENERATED CHAIN CONFIG (start) ---
// Do not edit manually - run 'make sync' in contracts/ to regenerate

export interface ChainConfig {
  name: string
  chainId: number
  usdc: string
  explorer: string
  checkoutBaseUrl: string
}

export type ChainKey = 'flowEvm' | 'base' | 'polkadotHub' | 'baseSepolia'

export const chains: Record<ChainKey, ChainConfig> = {
  flowEvm: {
    name: 'Flow EVM',
    chainId: 747,
    usdc: '0xF1815bd50389c46847f0Bda824eC8da914045D14',
    explorer: 'https://evm.flowscan.io',
    checkoutBaseUrl: 'https://flow.autopayprotocol.com',
  },
  base: {
    name: 'Base',
    chainId: 8453,
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    explorer: 'https://basescan.org',
    checkoutBaseUrl: 'https://autopayprotocol.com',
  },
  polkadotHub: {
    name: 'Polkadot Hub',
    chainId: 420420419,
    usdc: '0x0000053900000000000000000000000001200000',
    explorer: 'https://blockscout.polkadot.io',
    checkoutBaseUrl: 'https://polkadot.autopayprotocol.com',
  },
  baseSepolia: {
    name: 'Base Sepolia',
    chainId: 84532,
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    explorer: 'https://sepolia.basescan.org',
    checkoutBaseUrl: 'https://staging.autopayprotocol.com',
  }
}

/** Default chain — Base (autopayprotocol.com, no subdomain) */
export const DEFAULT_CHAIN: ChainKey = 'base'

/** Default checkout base URL (Base) */
export const DEFAULT_CHECKOUT_BASE_URL = 'https://autopayprotocol.com'

// --- AUTO-GENERATED CHAIN CONFIG (end) ---

/** Default IPFS gateway for resolving CIDs */
export const DEFAULT_IPFS_GATEWAY = 'https://w3s.link'

/** Build an IPFS gateway URL from a CID */
export function ipfsGatewayUrl(cid: string, gateway = DEFAULT_IPFS_GATEWAY): string {
  return `${gateway}/ipfs/${cid}`
}
