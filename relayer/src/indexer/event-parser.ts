import { decodeEventLog, type Log } from 'viem'
import ArcPolicyManagerAbi from '../abis/ArcPolicyManager.json' with { type: 'json' }
import type {
  PolicyCreatedEvent,
  PolicyRevokedEvent,
  ChargeSucceededEvent,
  ChargeFailedEvent,
  PolicyCancelledByFailureEvent,
} from '../types.js'

type AbiType = typeof ArcPolicyManagerAbi

export function parsePolicyCreated(log: Log): PolicyCreatedEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: ArcPolicyManagerAbi as AbiType,
      data: log.data,
      topics: log.topics,
    })

    if (decoded.eventName !== 'PolicyCreated') return null

    const args = decoded.args as unknown as {
      policyId: `0x${string}`
      payer: `0x${string}`
      merchant: `0x${string}`
      chargeAmount: bigint
      interval: number
      spendingCap: bigint
      metadataUrl: string
    }

    return {
      policyId: args.policyId,
      payer: args.payer,
      merchant: args.merchant,
      chargeAmount: args.chargeAmount,
      interval: args.interval,
      spendingCap: args.spendingCap,
      metadataUrl: args.metadataUrl,
      blockNumber: log.blockNumber!,
      transactionHash: log.transactionHash!,
    }
  } catch {
    return null
  }
}

export function parsePolicyRevoked(log: Log): PolicyRevokedEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: ArcPolicyManagerAbi as AbiType,
      data: log.data,
      topics: log.topics,
    })

    if (decoded.eventName !== 'PolicyRevoked') return null

    const args = decoded.args as unknown as {
      policyId: `0x${string}`
      payer: `0x${string}`
      merchant: `0x${string}`
      endTime: number
    }

    return {
      policyId: args.policyId,
      payer: args.payer,
      merchant: args.merchant,
      endTime: args.endTime,
      blockNumber: log.blockNumber!,
      transactionHash: log.transactionHash!,
    }
  } catch {
    return null
  }
}

export function parseChargeSucceeded(log: Log): ChargeSucceededEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: ArcPolicyManagerAbi as AbiType,
      data: log.data,
      topics: log.topics,
    })

    if (decoded.eventName !== 'ChargeSucceeded') return null

    const args = decoded.args as unknown as {
      policyId: `0x${string}`
      payer: `0x${string}`
      merchant: `0x${string}`
      amount: bigint
      protocolFee: bigint
    }

    return {
      policyId: args.policyId,
      payer: args.payer,
      merchant: args.merchant,
      amount: args.amount,
      protocolFee: args.protocolFee,
      blockNumber: log.blockNumber!,
      transactionHash: log.transactionHash!,
    }
  } catch {
    return null
  }
}

export function parseChargeFailed(log: Log): ChargeFailedEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: ArcPolicyManagerAbi as AbiType,
      data: log.data,
      topics: log.topics,
    })

    if (decoded.eventName !== 'ChargeFailed') return null

    const args = decoded.args as unknown as {
      policyId: `0x${string}`
      reason: string
    }

    return {
      policyId: args.policyId,
      reason: args.reason,
      blockNumber: log.blockNumber!,
      transactionHash: log.transactionHash!,
    }
  } catch {
    return null
  }
}

export function parsePolicyCancelledByFailure(log: Log): PolicyCancelledByFailureEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: ArcPolicyManagerAbi as AbiType,
      data: log.data,
      topics: log.topics,
    })

    if (decoded.eventName !== 'PolicyCancelledByFailure') return null

    const args = decoded.args as unknown as {
      policyId: `0x${string}`
      payer: `0x${string}`
      merchant: `0x${string}`
      consecutiveFailures: number
      endTime: number
    }

    return {
      policyId: args.policyId,
      payer: args.payer,
      merchant: args.merchant,
      consecutiveFailures: args.consecutiveFailures,
      endTime: args.endTime,
      blockNumber: log.blockNumber!,
      transactionHash: log.transactionHash!,
    }
  } catch {
    return null
  }
}

export type ParsedEvent =
  | { type: 'PolicyCreated'; event: PolicyCreatedEvent }
  | { type: 'PolicyRevoked'; event: PolicyRevokedEvent }
  | { type: 'ChargeSucceeded'; event: ChargeSucceededEvent }
  | { type: 'ChargeFailed'; event: ChargeFailedEvent }
  | { type: 'PolicyCancelledByFailure'; event: PolicyCancelledByFailureEvent }

export function parseLog(log: Log): ParsedEvent | null {
  // Try each event type
  const policyCreated = parsePolicyCreated(log)
  if (policyCreated) return { type: 'PolicyCreated', event: policyCreated }

  const policyRevoked = parsePolicyRevoked(log)
  if (policyRevoked) return { type: 'PolicyRevoked', event: policyRevoked }

  const chargeSucceeded = parseChargeSucceeded(log)
  if (chargeSucceeded) return { type: 'ChargeSucceeded', event: chargeSucceeded }

  const chargeFailed = parseChargeFailed(log)
  if (chargeFailed) return { type: 'ChargeFailed', event: chargeFailed }

  const policyCancelled = parsePolicyCancelledByFailure(log)
  if (policyCancelled) return { type: 'PolicyCancelledByFailure', event: policyCancelled }

  return null
}
