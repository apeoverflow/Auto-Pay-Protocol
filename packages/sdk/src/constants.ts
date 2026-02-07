// ---------------------------------------------------------------------------
// Intervals (seconds)
// ---------------------------------------------------------------------------

export const intervals = {
  /** 1 minute — useful for testing */
  minute: 60,
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

export interface ChainConfig {
  name: string
  chainId: number
  cctpDomain: number
  usdc: string
  explorer: string
}

export const chains: Record<string, ChainConfig> = {
  polygonAmoy: {
    name: 'Polygon Amoy',
    chainId: 80002,
    cctpDomain: 7,
    usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    explorer: 'https://amoy.polygonscan.com',
  },
  arbitrumSepolia: {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    cctpDomain: 3,
    usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    explorer: 'https://sepolia.arbiscan.io',
  },
  arcTestnet: {
    name: 'Arc Testnet',
    chainId: 1868,
    cctpDomain: 26,
    usdc: '0x3600000000000000000000000000000000000000',
    explorer: 'https://explorer-testnet.arc.gel.network',
  },
}

/** Default checkout base URL */
export const DEFAULT_CHECKOUT_BASE_URL = 'https://autopayprotocol.com'
