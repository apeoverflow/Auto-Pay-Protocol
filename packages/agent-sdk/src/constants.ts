export const intervals = {
  seconds: 1,
  minutes: 60,
  minute: 60,
  hourly: 3_600,
  daily: 86_400,
  weekly: 604_800,
  biweekly: 1_209_600,
  monthly: 2_592_000,
  quarterly: 7_776_000,
  yearly: 31_536_000,
} as const

/** Protocol fee in basis points (2.5%) */
export const PROTOCOL_FEE_BPS = 250

/** USDC uses 6 decimals */
export const USDC_DECIMALS = 6

/** Minimum interval (1 minute) */
export const MIN_INTERVAL = 60

/** Maximum interval (365 days) */
export const MAX_INTERVAL = 31_536_000
