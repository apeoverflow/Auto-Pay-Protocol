import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  type PublicClient,
  type WalletClient,
  type Account,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import ArcPolicyManagerAbi from '../abis/ArcPolicyManager.json' with { type: 'json' }
import type { RelayerConfig, ChainConfig, ChargeResult, CanChargeResult } from '../types.js'
import { estimateGas } from './gas-estimator.js'
import { createLogger } from '../utils/logger.js'
import { getPolicyByIdOnly } from '../db/policies.js'
import { getChainConfig } from '../config.js'

const logger = createLogger('executor:charge')

type AbiType = typeof ArcPolicyManagerAbi

// Create clients for a chain
function createClients(
  chainConfig: ChainConfig,
  account: Account
): { publicClient: PublicClient; walletClient: WalletClient } {
  const publicClient = createPublicClient({
    transport: http(chainConfig.rpcUrl),
  })

  const walletClient = createWalletClient({
    account,
    transport: http(chainConfig.rpcUrl),
  })

  return { publicClient, walletClient }
}

// Check if a policy can be charged
export async function canCharge(
  publicClient: PublicClient,
  contractAddress: `0x${string}`,
  policyId: `0x${string}`
): Promise<CanChargeResult> {
  try {
    const result = await publicClient.readContract({
      address: contractAddress,
      abi: ArcPolicyManagerAbi as AbiType,
      functionName: 'canCharge',
      args: [policyId],
    }) as [boolean, string]

    return {
      canCharge: result[0],
      reason: result[1],
    }
  } catch (error) {
    return {
      canCharge: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Execute a charge for a policy
export async function chargePolicy(
  policyId: string,
  config: RelayerConfig
): Promise<ChargeResult> {
  logger.info({ policyId }, 'Attempting to charge policy')

  // First, find which chain this policy is on
  const policy = await getPolicyByIdOnly(config.databaseUrl, policyId)
  if (!policy) {
    return {
      success: false,
      policyId,
      error: 'Policy not found in database',
    }
  }

  const chainConfig = getChainConfig(config, policy.chain_id)
  if (!chainConfig) {
    return {
      success: false,
      policyId,
      error: `Unknown chain ${policy.chain_id}`,
    }
  }

  const account = privateKeyToAccount(config.privateKey)
  const { publicClient, walletClient } = createClients(chainConfig, account)

  // Check if policy can be charged
  const canChargeResult = await canCharge(
    publicClient,
    chainConfig.policyManagerAddress,
    policyId as `0x${string}`
  )

  if (!canChargeResult.canCharge) {
    // Balance/allowance issues are soft-fails — track them for auto-cancellation
    const isBalanceOrAllowanceIssue = canChargeResult.reason.includes('Insufficient')
    if (isBalanceOrAllowanceIssue) {
      logger.info({ policyId, reason: canChargeResult.reason }, 'Pre-check soft-fail (balance/allowance)')
      return {
        success: false,
        softFailed: true,
        policyId,
        error: canChargeResult.reason,
      }
    }

    logger.warn({ policyId, reason: canChargeResult.reason }, 'Cannot charge policy')
    return {
      success: false,
      policyId,
      error: canChargeResult.reason,
    }
  }

  // Estimate gas with chain-specific settings
  const gasEstimate = await estimateGas(publicClient, chainConfig)

  try {
    // Simulate the transaction first
    const { request } = await publicClient.simulateContract({
      address: chainConfig.policyManagerAddress,
      abi: ArcPolicyManagerAbi as AbiType,
      functionName: 'charge',
      args: [policyId as `0x${string}`],
      account,
      maxFeePerGas: gasEstimate.maxFeePerGas,
      maxPriorityFeePerGas: gasEstimate.maxPriorityFeePerGas,
    })

    // Execute the transaction
    const hash = await walletClient.writeContract(request)

    logger.info({ policyId, txHash: hash }, 'Charge transaction submitted')

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    if (receipt.status === 'reverted') {
      return {
        success: false,
        policyId,
        txHash: hash,
        error: 'Transaction reverted',
      }
    }

    // Check for ChargeSucceeded vs ChargeFailed events to determine outcome
    const chargeSucceededLog = receipt.logs.find((log) => {
      return log.topics[0] === getEventSignature('ChargeSucceeded')
    })

    const chargeFailedLog = receipt.logs.find((log) => {
      return log.topics[0] === getEventSignature('ChargeFailed')
    })

    // Soft-fail: tx succeeded but charge returned false (balance/allowance issue)
    if (chargeFailedLog && !chargeSucceededLog) {
      logger.info({ policyId, txHash: hash }, 'Charge soft-failed (insufficient balance/allowance)')
      return {
        success: false,
        softFailed: true,
        policyId,
        txHash: hash,
        error: 'Insufficient balance or allowance',
      }
    }

    let amount: string | undefined
    let protocolFee: string | undefined

    if (chargeSucceededLog && chargeSucceededLog.data) {
      // Decode the non-indexed args (amount, protocolFee)
      // They are encoded as two uint128 values
      const data = chargeSucceededLog.data.slice(2) // Remove 0x
      amount = BigInt('0x' + data.slice(0, 64)).toString()
      protocolFee = BigInt('0x' + data.slice(64, 128)).toString()
    }

    logger.info(
      { policyId, txHash: hash, amount, protocolFee },
      'Charge successful'
    )

    return {
      success: true,
      policyId,
      txHash: hash,
      amount,
      protocolFee,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error({ policyId, error: errorMessage }, 'Charge failed')

    return {
      success: false,
      policyId,
      error: errorMessage,
    }
  }
}

// Execute cancelFailedPolicy on-chain
export async function cancelFailedPolicyOnChain(
  policyId: string,
  config: RelayerConfig,
  chainId: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const chainConfig = getChainConfig(config, chainId)
  if (!chainConfig) {
    return { success: false, error: `Unknown chain ${chainId}` }
  }

  const account = privateKeyToAccount(config.privateKey)
  const { publicClient, walletClient } = createClients(chainConfig, account)
  const gasEstimate = await estimateGas(publicClient, chainConfig)

  try {
    const { request } = await publicClient.simulateContract({
      address: chainConfig.policyManagerAddress,
      abi: ArcPolicyManagerAbi as AbiType,
      functionName: 'cancelFailedPolicy',
      args: [policyId as `0x${string}`],
      account,
      maxFeePerGas: gasEstimate.maxFeePerGas,
      maxPriorityFeePerGas: gasEstimate.maxPriorityFeePerGas,
    })

    const hash = await walletClient.writeContract(request)
    await publicClient.waitForTransactionReceipt({ hash })

    logger.info({ policyId, txHash: hash }, 'cancelFailedPolicy executed')
    return { success: true, txHash: hash }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error({ policyId, error: errorMessage }, 'cancelFailedPolicy failed')
    return { success: false, error: errorMessage }
  }
}

// Helper to get event signature (topic0)
function getEventSignature(eventName: string): `0x${string}` {
  // Compute signature using keccak256
  if (eventName === 'ChargeSucceeded') {
    return keccak256(
      toHex('ChargeSucceeded(bytes32,address,address,uint128,uint128)')
    )
  }
  if (eventName === 'ChargeFailed') {
    return keccak256(
      toHex('ChargeFailed(bytes32,string)')
    )
  }

  return '0x' as `0x${string}`
}
