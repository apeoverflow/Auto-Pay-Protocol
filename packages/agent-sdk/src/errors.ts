export class AgentError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'AgentError'
    this.code = code
  }
}

export class InsufficientBalanceError extends AgentError {
  readonly required: bigint
  readonly available: bigint

  constructor(required: bigint, available: bigint) {
    super(
      `Insufficient USDC balance: need ${required}, have ${available}`,
      'INSUFFICIENT_BALANCE',
    )
    this.name = 'InsufficientBalanceError'
    this.required = required
    this.available = available
  }
}

export class InsufficientGasError extends AgentError {
  constructor() {
    super(
      'No native token balance for gas — fund the agent wallet',
      'INSUFFICIENT_GAS',
    )
    this.name = 'InsufficientGasError'
  }
}

export class InsufficientAllowanceError extends AgentError {
  constructor(required: bigint, current: bigint) {
    super(
      `Insufficient USDC allowance: need ${required}, have ${current}`,
      'INSUFFICIENT_ALLOWANCE',
    )
    this.name = 'InsufficientAllowanceError'
  }
}

export class PolicyNotFoundError extends AgentError {
  constructor(policyId: string) {
    super(`Policy not found: ${policyId}`, 'POLICY_NOT_FOUND')
    this.name = 'PolicyNotFoundError'
  }
}

export class PolicyNotActiveError extends AgentError {
  constructor(policyId: string) {
    super(`Policy is not active: ${policyId}`, 'POLICY_NOT_ACTIVE')
    this.name = 'PolicyNotActiveError'
  }
}

export class TransactionFailedError extends AgentError {
  readonly txHash?: string

  constructor(message: string, txHash?: string) {
    super(message, 'TRANSACTION_FAILED')
    this.name = 'TransactionFailedError'
    this.txHash = txHash
  }
}

export class BridgeQuoteError extends AgentError {
  constructor(message: string) {
    super(message, 'BRIDGE_QUOTE_FAILED')
    this.name = 'BridgeQuoteError'
  }
}

export class BridgeExecutionError extends AgentError {
  readonly sourceTxHash?: `0x${string}`

  constructor(message: string, sourceTxHash?: `0x${string}`) {
    super(message, 'BRIDGE_EXECUTION_FAILED')
    this.name = 'BridgeExecutionError'
    this.sourceTxHash = sourceTxHash
  }
}

export class BridgeTimeoutError extends AgentError {
  readonly sourceTxHash: `0x${string}`

  constructor(sourceTxHash: `0x${string}`) {
    super(
      `Bridge timed out waiting for completion. Source tx: ${sourceTxHash}`,
      'BRIDGE_TIMEOUT',
    )
    this.name = 'BridgeTimeoutError'
    this.sourceTxHash = sourceTxHash
  }
}
