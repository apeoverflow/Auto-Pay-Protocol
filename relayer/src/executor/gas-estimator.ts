import type { PublicClient } from 'viem'
import type { ChainConfig } from '../types.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('executor:gas')

export interface GasEstimate {
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

// Get gas estimate for a chain
// Arc-specific: must use minimum 1 gwei priority fee
export async function estimateGas(
  client: PublicClient,
  chainConfig: ChainConfig
): Promise<GasEstimate> {
  // Get current gas price from network
  const feeHistory = await client.estimateFeesPerGas()

  let maxPriorityFeePerGas = feeHistory.maxPriorityFeePerGas ?? 1_000_000_000n
  let maxFeePerGas = feeHistory.maxFeePerGas ?? 50_000_000_000n

  // Apply chain-specific minimum fees (Arc requires 1 gwei min priority)
  if (chainConfig.minGasFees) {
    if (maxPriorityFeePerGas < chainConfig.minGasFees.maxPriorityFeePerGas) {
      maxPriorityFeePerGas = chainConfig.minGasFees.maxPriorityFeePerGas
    }
    if (maxFeePerGas < chainConfig.minGasFees.maxFeePerGas) {
      maxFeePerGas = chainConfig.minGasFees.maxFeePerGas
    }
    // Ensure maxFeePerGas > maxPriorityFeePerGas
    if (maxFeePerGas <= maxPriorityFeePerGas) {
      maxFeePerGas = maxPriorityFeePerGas + 1_000_000_000n // Add 1 gwei buffer
    }
  }

  logger.debug(
    {
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
    },
    'Estimated gas'
  )

  return { maxFeePerGas, maxPriorityFeePerGas }
}
