import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/** Format a USDC amount string (e.g. "9.99") to "9.99" */
export function formatUSDCString(amount: string): string {
  const num = parseFloat(amount)
  if (isNaN(num)) return '0.00'
  return num.toFixed(2)
}

/** Format seconds to a human-readable interval (e.g. "1 month") */
export function formatIntervalLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    return mins === 1 ? '1 minute' : `${mins} minutes`
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    return hours === 1 ? '1 hour' : `${hours} hours`
  }
  const days = Math.floor(seconds / 86400)
  if (days === 1) return '1 day'
  if (days === 7) return '1 week'
  if (days === 30 || days === 31) return '1 month'
  if (days === 365) return '1 year'
  return `${days} days`
}
