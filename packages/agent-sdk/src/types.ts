import type { ChainKey } from './chains'
export type { ChainKey } from './chains'

export type IntervalPreset = 'hourly' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

export interface SubscribeParams {
  merchant: `0x${string}`
  /** Human-readable USDC amount (e.g. 10 = 10 USDC) */
  amount: number
  /** Interval in seconds, or a preset name */
  interval: number | IntervalPreset
  /** Human-readable USDC spending cap. 0 = unlimited. Default: amount * 30 */
  spendingCap?: number
  /** Optional metadata URL (e.g. IPFS CID for plan info) */
  metadataUrl?: string
}

export interface Subscription {
  policyId: `0x${string}`
  txHash: `0x${string}`
}

export interface Policy {
  policyId: `0x${string}`
  payer: `0x${string}`
  merchant: `0x${string}`
  chargeAmount: bigint
  spendingCap: bigint
  totalSpent: bigint
  interval: number
  lastCharged: number
  chargeCount: number
  consecutiveFailures: number
  endTime: number
  active: boolean
  metadataUrl: string
}

export interface AgentConfig {
  privateKey: `0x${string}`
  /** Chain to use. Default: 'base' */
  chain?: ChainKey
  /** Override the default public RPC URL */
  rpcUrl?: string
  /** Override the PolicyManager contract address */
  policyManager?: `0x${string}`
  /** Override the USDC contract address */
  usdc?: `0x${string}`
}

// ── Bridge types ────────────────────────────────────────────────

export interface BridgeParams {
  /** Source chain ID (e.g. 1 for Ethereum, 137 for Polygon) */
  fromChainId: number
  /** USDC amount in human-readable units (e.g. 10 = 10 USDC) */
  amount: number
  /** RPC URL for the source chain (to submit the bridge tx) */
  sourceRpcUrl: string
  /** Optional slippage in percent. Default: 0.5 */
  slippage?: number
  /** Optional poll interval ms for status checks. Default: 10000 */
  pollIntervalMs?: number
  /** Optional timeout ms. Default: 1800000 (30 min) */
  timeoutMs?: number
  /** Optional callback for status updates */
  onStatus?: (status: BridgeStatus) => void
}

export interface BridgeResult {
  sourceTxHash: `0x${string}`
  destinationTxHash?: string
  fromChainId: number
  toChainId: number
  fromAmount: string
  toAmount: string
  /** Total bridge time in ms */
  durationMs: number
}

export type BridgeStatus =
  | { step: 'quoting' }
  | { step: 'approving'; token: string }
  | { step: 'bridging'; txHash: `0x${string}` }
  | { step: 'waiting'; txHash: `0x${string}` }
  | { step: 'complete'; result: BridgeResult }
  | { step: 'failed'; error: string }

// ── Swap types ──────────────────────────────────────────────────

export interface SwapParams {
  /** Human-readable native token amount (e.g. 1 = 1 FLOW) */
  amount: number
  /** Slippage in percent. Default: 0.5 */
  slippage?: number
  /** Poll interval ms for status checks. Default: 10000 */
  pollIntervalMs?: number
  /** Timeout ms. Default: 1800000 (30 min) */
  timeoutMs?: number
  /** Optional callback for status updates (reuses BridgeStatus) */
  onStatus?: (status: BridgeStatus) => void
}

export interface SwapResult {
  txHash: `0x${string}`
  /** Formatted native token input amount */
  nativeAmount: string
  /** Formatted USDC output amount */
  usdcAmount: string
  /** Total swap time in ms */
  durationMs: number
}
