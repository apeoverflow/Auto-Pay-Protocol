// Shared TypeScript interfaces for the relayer

export interface ChainConfig {
  chainId: number
  name: string
  rpcUrl: string
  policyManagerAddress: `0x${string}`
  startBlock: number
  pollIntervalMs: number
  batchSize: number
  confirmations: number
  enabled: boolean
  minGasFees?: {
    maxPriorityFeePerGas: bigint
    maxFeePerGas: bigint
  }
}

export type RetryPreset = 'aggressive' | 'standard' | 'conservative' | 'custom'

export interface RetryConfig {
  preset: RetryPreset
  maxRetries: number
  backoffMs: number[] // Backoff times for each retry
  maxConsecutiveFailures: number // Before cancelling policy
}

export interface RelayerConfig {
  chains: Record<string, ChainConfig>
  privateKey: `0x${string}`
  databaseUrl: string
  indexer: {
    pollIntervalMs: number
    batchSize: number
    confirmations: number
  }
  executor: {
    runIntervalMs: number
    batchSize: number
  }
  retry: RetryConfig
  webhooks: {
    timeoutMs: number
    maxRetries: number
  }
  merchantAddresses: Set<string> | null // null = process all merchants
  port: number
  logLevel: string
}

// Database types

export interface PolicyRow {
  id: string // policyId as hex
  chain_id: number
  payer: string
  merchant: string
  charge_amount: string
  spending_cap: string
  total_spent: string
  interval_seconds: number
  last_charged_at: Date | null
  next_charge_at: Date
  charge_count: number
  active: boolean
  metadata_url: string | null
  created_at: Date
  ended_at: Date | null
  created_block: number
  created_tx: string
  consecutive_failures: number
  last_failure_reason: string | null
  cancelled_by_failure: boolean
  cancelled_at: Date | null
}

export interface ChargeRow {
  id: number
  policy_id: string
  chain_id: number
  tx_hash: string | null
  status: 'pending' | 'success' | 'failed'
  amount: string
  protocol_fee: string | null
  error_message: string | null
  attempt_count: number
  created_at: Date
  completed_at: Date | null
}

export interface IndexerStateRow {
  chain_id: number
  last_indexed_block: number
  updated_at: Date
}

export interface WebhookRow {
  id: number
  policy_id: string
  charge_id: number | null
  event_type: WebhookEventType
  payload: string // JSON string
  status: 'pending' | 'sent' | 'failed'
  attempts: number
  next_attempt_at: Date
  last_attempt_at: Date | null
  created_at: Date
}

export interface MerchantRow {
  address: string
  webhook_url: string | null
  webhook_secret: string | null
  created_at: Date
}

// Event types

export type WebhookEventType =
  | 'charge.succeeded'
  | 'charge.failed'
  | 'policy.created'
  | 'policy.revoked'
  | 'policy.cancelled_by_failure'

export interface WebhookPayload {
  event: WebhookEventType
  timestamp: string
  data: {
    policyId: string
    chainId: number
    payer: string
    merchant: string
    amount?: string
    protocolFee?: string
    txHash?: string
    reason?: string
    chargeAmount?: string
    interval?: number
    spendingCap?: string
    metadataUrl?: string
    endTime?: number
  }
}

// Parsed contract events

export interface PolicyCreatedEvent {
  policyId: `0x${string}`
  payer: `0x${string}`
  merchant: `0x${string}`
  chargeAmount: bigint
  interval: number
  spendingCap: bigint
  metadataUrl: string
  blockNumber: bigint
  transactionHash: `0x${string}`
}

export interface PolicyRevokedEvent {
  policyId: `0x${string}`
  payer: `0x${string}`
  merchant: `0x${string}`
  endTime: number
  blockNumber: bigint
  transactionHash: `0x${string}`
}

export interface ChargeSucceededEvent {
  policyId: `0x${string}`
  payer: `0x${string}`
  merchant: `0x${string}`
  amount: bigint
  protocolFee: bigint
  blockNumber: bigint
  transactionHash: `0x${string}`
}

export interface ChargeFailedEvent {
  policyId: `0x${string}`
  reason: string
  blockNumber: bigint
  transactionHash: `0x${string}`
}

export interface PolicyCancelledByFailureEvent {
  policyId: `0x${string}`
  payer: `0x${string}`
  merchant: `0x${string}`
  consecutiveFailures: number
  endTime: number
  blockNumber: bigint
  transactionHash: `0x${string}`
}

// Execution results

export interface ChargeResult {
  success: boolean
  softFailed?: boolean // tx succeeded but charge soft-failed (balance/allowance)
  policyId: string
  txHash?: string
  amount?: string
  protocolFee?: string
  error?: string
}

export interface CanChargeResult {
  canCharge: boolean
  reason: string
}
