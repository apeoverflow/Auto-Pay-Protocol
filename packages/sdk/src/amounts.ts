import { USDC_DECIMALS, PROTOCOL_FEE_BPS } from './constants'
import type { FeeBreakdown } from './types'

const USDC_FACTOR = 10 ** USDC_DECIMALS // 1_000_000

/**
 * Format a raw USDC amount (6-decimal string) to a human-readable string.
 *
 * @example
 * ```ts
 * formatUSDC('9990000') // "9.99"
 * formatUSDC('100000')  // "0.10"
 * ```
 */
export function formatUSDC(rawAmount: string): string {
  const num = Number(rawAmount) / USDC_FACTOR
  // Use fixed-point to avoid floating-point display issues
  // Trim trailing zeros but keep at least 2 decimal places
  const fixed = num.toFixed(6)
  // Remove trailing zeros, but keep at least "X.XX"
  const parts = fixed.split('.')
  let decimals = parts[1].replace(/0+$/, '')
  if (decimals.length < 2) decimals = decimals.padEnd(2, '0')
  return `${parts[0]}.${decimals}`
}

/**
 * Parse a human-readable USDC amount to a raw 6-decimal string.
 *
 * @example
 * ```ts
 * parseUSDC(9.99)  // "9990000"
 * parseUSDC(0.10)  // "100000"
 * ```
 */
export function parseUSDC(amount: number): string {
  // Use string math to avoid floating-point errors
  // Multiply by 1_000_000 using integer arithmetic on the string parts
  const str = amount.toFixed(USDC_DECIMALS)
  const [whole, frac] = str.split('.')
  const padded = (frac || '').padEnd(USDC_DECIMALS, '0').slice(0, USDC_DECIMALS)
  const raw = BigInt(whole) * BigInt(USDC_FACTOR) + BigInt(padded)
  return raw.toString()
}

/**
 * Calculate the fee breakdown for a charge amount.
 *
 * @param rawAmount - Raw USDC amount (6-decimal string) OR human-readable number
 *
 * @example
 * ```ts
 * calculateFeeBreakdown('9990000')
 * // { total: "9.99", merchantReceives: "9.74", protocolFee: "0.25", feePercentage: "2.5%" }
 * ```
 */
export function calculateFeeBreakdown(rawAmount: string): FeeBreakdown {
  const totalRaw = BigInt(rawAmount)
  const feeRaw = (totalRaw * BigInt(PROTOCOL_FEE_BPS)) / 10_000n
  const merchantRaw = totalRaw - feeRaw

  return {
    total: formatUSDC(totalRaw.toString()),
    merchantReceives: formatUSDC(merchantRaw.toString()),
    protocolFee: formatUSDC(feeRaw.toString()),
    feePercentage: `${PROTOCOL_FEE_BPS / 100}%`,
  }
}

/**
 * Format an interval in seconds to a human-readable label.
 *
 * @example
 * ```ts
 * formatInterval(2592000)  // "monthly"
 * formatInterval(604800)   // "weekly"
 * formatInterval(86400)    // "1 day"
 * formatInterval(172800)   // "2 days"
 * ```
 */
export function formatInterval(seconds: number): string {
  // Check for well-known presets first
  const presets: Record<number, string> = {
    604_800: 'weekly',
    1_209_600: 'biweekly',
    2_592_000: 'monthly',
    7_776_000: 'quarterly',
    31_536_000: 'yearly',
  }
  if (presets[seconds]) return presets[seconds]

  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)

  if (days > 0 && hours > 0) return `${days}d ${hours}h`
  if (days > 0) return days === 1 ? '1 day' : `${days} days`
  if (hours > 0) return hours === 1 ? '1 hour' : `${hours} hours`
  if (minutes > 0) return minutes === 1 ? '1 minute' : `${minutes} minutes`
  return `${seconds}s`
}
