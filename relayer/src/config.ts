import 'dotenv/config'
import type { RelayerConfig, ChainConfig, RetryConfig, RetryPreset } from './types.js'

export type { RelayerConfig, ChainConfig, RetryConfig, RetryPreset }

// Retry presets
export const RETRY_PRESETS: Record<Exclude<RetryPreset, 'custom'>, Omit<RetryConfig, 'preset'>> = {
  aggressive: {
    maxRetries: 3,
    backoffMs: [30_000, 60_000, 120_000], // 30s, 1min, 2min
    maxConsecutiveFailures: 3,
  },
  standard: {
    maxRetries: 3,
    backoffMs: [60_000, 300_000, 900_000], // 1min, 5min, 15min
    maxConsecutiveFailures: 3,
  },
  conservative: {
    maxRetries: 5,
    backoffMs: [300_000, 900_000, 1_800_000, 3_600_000, 7_200_000], // 5min, 15min, 30min, 1hr, 2hr
    maxConsecutiveFailures: 5,
  },
}

function parseRetryConfig(): RetryConfig {
  const preset = (process.env.RETRY_PRESET || 'standard') as RetryPreset

  if (preset === 'custom') {
    // Custom config from env vars
    const maxRetries = parseInt(process.env.RETRY_MAX_RETRIES || '3', 10)
    const backoffStr = process.env.RETRY_BACKOFF_MS || '60000,300000,900000'
    const backoffMs = backoffStr.split(',').map((s) => parseInt(s.trim(), 10))
    const maxConsecutiveFailures = parseInt(process.env.RETRY_MAX_CONSECUTIVE_FAILURES || '3', 10)

    return {
      preset: 'custom',
      maxRetries,
      backoffMs,
      maxConsecutiveFailures,
    }
  }

  if (!(preset in RETRY_PRESETS)) {
    throw new Error(`Invalid RETRY_PRESET: ${preset}. Must be one of: aggressive, standard, conservative, custom`)
  }

  return {
    preset,
    ...RETRY_PRESETS[preset],
  }
}

// Arc Testnet is the only deployed chain
const ARC_TESTNET_CONFIG: ChainConfig = {
  chainId: 5042002,
  name: 'Arc Testnet',
  rpcUrl: process.env.ARC_TESTNET_RPC || 'https://rpc.testnet.arc.network',
  policyManagerAddress: '0xCa974B1EeC022B6E27bfA24D021F518C4d5b3734',
  startBlock: 25313040,
  pollIntervalMs: 15000, // 15 seconds
  batchSize: 9000, // Arc limits to 10k blocks, use 9k for safety
  confirmations: 2,
  enabled: true,
  // Arc bundler requires minimum 1 gwei priority fee
  minGasFees: {
    maxPriorityFeePerGas: 1_000_000_000n, // 1 gwei
    maxFeePerGas: 50_000_000_000n, // 50 gwei
  },
}

function getRequiredEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue
}

export function loadConfig(): RelayerConfig {
  // Validate required env vars
  const databaseUrl = getRequiredEnv('DATABASE_URL')
  const privateKey = getRequiredEnv('RELAYER_PRIVATE_KEY') as `0x${string}`

  if (!privateKey.startsWith('0x')) {
    throw new Error('RELAYER_PRIVATE_KEY must start with 0x')
  }

  return {
    chains: {
      arcTestnet: ARC_TESTNET_CONFIG,
    },
    privateKey,
    databaseUrl,
    indexer: {
      pollIntervalMs: 15000, // 15 seconds
      batchSize: 9000,
      confirmations: 2,
    },
    executor: {
      runIntervalMs: 60000, // 1 minute
      batchSize: 10,
    },
    retry: parseRetryConfig(),
    webhooks: {
      timeoutMs: 10000, // 10 seconds
      maxRetries: 3,
    },
    port: parseInt(getOptionalEnv('PORT', '3001'), 10),
    logLevel: getOptionalEnv('LOG_LEVEL', 'info'),
  }
}

export function getEnabledChains(config: RelayerConfig): ChainConfig[] {
  return Object.values(config.chains).filter((c) => c.enabled)
}

export function getChainConfig(
  config: RelayerConfig,
  chainId: number
): ChainConfig | undefined {
  return Object.values(config.chains).find((c) => c.chainId === chainId)
}
