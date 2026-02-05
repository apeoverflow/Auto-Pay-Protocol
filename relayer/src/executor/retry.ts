import type { RetryConfig } from '../types.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('executor:retry')

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

// Format retry config for display
export function formatRetryConfig(config: RetryConfig): string {
  const formatMs = (ms: number) => {
    if (ms >= 3600000) return `${ms / 3600000}hr`
    if (ms >= 60000) return `${ms / 60000}min`
    return `${ms / 1000}s`
  }

  const backoffs = config.backoffMs.map(formatMs).join(' → ')
  return `${config.preset} (${config.maxRetries} retries: ${backoffs}, cancel after ${config.maxConsecutiveFailures} failures)`
}
