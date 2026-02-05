import { createLogger } from '../utils/logger.js'

const logger = createLogger('executor:retry')

export interface RetryConfig {
  maxRetries: number
  backoffMs: number[]  // Backoff times for each retry (e.g., [60000, 300000, 900000])
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoffMs: [60_000, 300_000, 900_000], // 1min, 5min, 15min
}

export function shouldRetry(attemptCount: number, config: RetryConfig): boolean {
  return attemptCount < config.maxRetries
}

export function getNextRetryDelay(attemptCount: number, config: RetryConfig): number {
  const index = Math.min(attemptCount - 1, config.backoffMs.length - 1)
  return config.backoffMs[index] ?? config.backoffMs[config.backoffMs.length - 1]
}

export function getNextRetryTime(attemptCount: number, config: RetryConfig): Date {
  const delay = getNextRetryDelay(attemptCount, config)
  return new Date(Date.now() + delay)
}

// Determine if an error is retryable
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Network/RPC errors - retryable
    if (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('503') ||
      message.includes('502')
    ) {
      return true
    }

    // Nonce errors - retryable (nonce may sync)
    if (message.includes('nonce')) {
      return true
    }

    // Gas estimation failures - may be temporary
    if (message.includes('gas') && !message.includes('insufficient')) {
      return true
    }

    // Revert errors - NOT retryable (business logic failure)
    if (
      message.includes('revert') ||
      message.includes('insufficient') ||
      message.includes('policy not active') ||
      message.includes('too soon')
    ) {
      return false
    }
  }

  // Unknown errors - don't retry by default
  return false
}

export function logRetryDecision(
  policyId: string,
  attemptCount: number,
  willRetry: boolean,
  error: unknown,
  config: RetryConfig
) {
  if (willRetry) {
    const nextDelay = getNextRetryDelay(attemptCount, config)
    logger.info(
      { policyId, attemptCount, nextDelayMs: nextDelay },
      'Will retry charge'
    )
  } else {
    logger.warn(
      { policyId, attemptCount, maxRetries: config.maxRetries, error },
      'Max retries exhausted or non-retryable error'
    )
  }
}
