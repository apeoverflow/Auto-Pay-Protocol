// On-chain policy types matching ArcPolicyManager.sol

export interface OnChainPolicy {
  policyId: `0x${string}`
  payer: `0x${string}`
  merchant: `0x${string}`
  chargeAmount: bigint
  spendingCap: bigint
  totalSpent: bigint
  interval: number      // seconds (uint32)
  lastCharged: number   // unix timestamp (uint32)
  chargeCount: number   // number of successful charges (uint32)
  consecutiveFailures: number // consecutive soft-fail count (uint8)
  endTime: number       // unix timestamp when revoked (uint32), 0 if active
  active: boolean
  metadataUrl: string
}

export interface CreatePolicyParams {
  merchant: `0x${string}`
  chargeAmount: bigint   // USDC amount (6 decimals)
  interval: number       // seconds
  spendingCap: bigint    // USDC amount (6 decimals)
  metadataUrl: string
}

export interface PolicyChargeBreakdown {
  total: bigint
  merchantReceives: bigint
  protocolFee: bigint
}

// Contract error messages mapped to user-friendly messages
export const POLICY_ERROR_MESSAGES: Record<string, string> = {
  InsufficientAllowance: 'Please approve more USDC',
  InsufficientBalance: 'Insufficient USDC balance',
  InvalidInterval: 'Interval must be 1 hour - 365 days',
  InvalidAmount: 'Invalid charge amount',
  InvalidMerchant: 'Invalid merchant address',
  PolicyNotActive: 'Subscription already cancelled',
  NotPolicyOwner: 'You can only cancel your own subscriptions',
  SpendingCapExceeded: 'Spending cap exceeded',
  TooSoonToCharge: 'Too soon to charge',
}

// Parse contract error to user message
export function parseContractError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message
    for (const [errorName, userMessage] of Object.entries(POLICY_ERROR_MESSAGES)) {
      if (message.includes(errorName)) {
        return userMessage
      }
    }
    // Try to extract revert reason
    const revertMatch = message.match(/reverted with reason string '([^']+)'/)
    if (revertMatch) {
      return revertMatch[1]
    }
  }
  return 'Transaction failed'
}
