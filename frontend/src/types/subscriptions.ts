// Subscription-related types

export interface Plan {
  id: string
  name: string
  merchantAddress: `0x${string}`
  merchantName: string
  amount: bigint // USDC amount (6 decimals)
  interval: number // seconds
  chainId: number
  active: boolean
}

export interface Subscription {
  id: string
  planId: string
  plan: Plan
  userAddress: `0x${string}`
  lastCharged: Date
  nextCharge: Date
  status: 'active' | 'paused' | 'cancelled' | 'failed'
  createdAt: Date
}

export interface ActivityItem {
  id: string
  type: 'charge' | 'subscribe' | 'cancel' | 'transfer'
  timestamp: Date
  amount?: bigint
  token?: string
  merchant?: string
  metadataUrl?: string
  subscription?: Subscription
  txHash: `0x${string}`
  status: 'confirmed' | 'pending' | 'failed'
}

// Helper to format USDC amounts
export function formatUSDC(amount: bigint): string {
  const value = Number(amount) / 1_000_000
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

// Helper to format interval
export function formatInterval(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)

  if (days >= 365) {
    const years = Math.floor(days / 365)
    const remDays = days % 365
    if (remDays === 0) return years === 1 ? 'Every 365d' : `Every ${years * 365}d`
    return `Every ${years * 365 + remDays}d`
  }
  if (days > 0 && hours > 0) return `Every ${days}d ${hours}h`
  if (days > 0) return `Every ${days}d`
  if (hours > 0) return `Every ${hours}h`
  return `Every ${seconds}s`
}

// Helper to get remaining time
export function getRemainingTime(date: Date): string {
  const now = new Date()
  const diff = date.getTime() - now.getTime()

  if (diff < 0) return 'Overdue'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h`
  return 'Soon'
}
