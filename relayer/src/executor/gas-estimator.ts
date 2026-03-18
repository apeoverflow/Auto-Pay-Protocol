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
  // Some chains (e.g. Polkadot Hub) don't support eth_feeHistory reward percentiles,
  // causing viem's estimateFeesPerGas to throw. Fall back to eth_gasPrice (legacy).
  let maxFeePerGas: bigint
  let maxPriorityFeePerGas: bigint

  try {
    const feeHistory = await client.estimateFeesPerGas()
    maxPriorityFeePerGas = feeHistory.maxPriorityFeePerGas ?? 1_000_000_000n
    maxFeePerGas = feeHistory.maxFeePerGas ?? 50_000_000_000n
  } catch {
    // Fallback to legacy gas price
    const gasPrice = await client.getGasPrice()
    maxFeePerGas = gasPrice
    maxPriorityFeePerGas = 0n
    logger.debug({ gasPrice: gasPrice.toString() }, 'Using legacy gas price (estimateFeesPerGas unsupported)')
  }

  // Apply chain-specific gas estimation correction (e.g. Polkadot Hub overestimates ~3x)
  // Must be applied before minGasFees floor so the floor remains authoritative
  if (chainConfig.gasEstimationDivisor && chainConfig.gasEstimationDivisor > 1) {
    const divisor = BigInt(chainConfig.gasEstimationDivisor)
    // Fetch current base fee to use as a floor — maxFeePerGas must never go below it
    let baseFeeFloor = 0n
    try {
      const block = await client.getBlock({ blockTag: 'latest' })
      baseFeeFloor = block.baseFeePerGas ?? 0n
    } catch {
      // If we can't get the base fee, skip the divisor entirely to be safe
      logger.debug('Could not fetch base fee for divisor floor — skipping gas correction')
    }
    if (baseFeeFloor > 0n) {
      const adjusted = maxFeePerGas / divisor
      // Floor at base fee + small buffer (10%) to avoid edge-case rejections
      const floor = baseFeeFloor + (baseFeeFloor / 10n)
      maxFeePerGas = adjusted > floor ? adjusted : floor
    }
    maxPriorityFeePerGas = maxPriorityFeePerGas / divisor
    // Ensure division doesn't produce zero (minimum 1 wei)
    if (maxPriorityFeePerGas === 0n) maxPriorityFeePerGas = 1n
  }

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
