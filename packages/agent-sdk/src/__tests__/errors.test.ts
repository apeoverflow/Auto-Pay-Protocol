import { describe, it, expect } from 'vitest'
import {
  AgentError,
  InsufficientBalanceError,
  InsufficientGasError,
  InsufficientAllowanceError,
  PolicyNotFoundError,
  PolicyNotActiveError,
  TransactionFailedError,
  BridgeQuoteError,
  BridgeExecutionError,
  BridgeTimeoutError,
} from '../errors'

describe('AgentError', () => {
  it('has code and message', () => {
    const err = new AgentError('test', 'TEST_CODE')
    expect(err.code).toBe('TEST_CODE')
    expect(err.message).toBe('test')
    expect(err.name).toBe('AgentError')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('InsufficientBalanceError', () => {
  it('exposes required and available', () => {
    const err = new InsufficientBalanceError(100n, 50n)
    expect(err.required).toBe(100n)
    expect(err.available).toBe(50n)
    expect(err.code).toBe('INSUFFICIENT_BALANCE')
    expect(err.message).toContain('100')
    expect(err.message).toContain('50')
    expect(err).toBeInstanceOf(AgentError)
  })
})

describe('InsufficientGasError', () => {
  it('has correct code', () => {
    const err = new InsufficientGasError()
    expect(err.code).toBe('INSUFFICIENT_GAS')
    expect(err.name).toBe('InsufficientGasError')
  })
})

describe('InsufficientAllowanceError', () => {
  it('has correct message', () => {
    const err = new InsufficientAllowanceError(200n, 100n)
    expect(err.code).toBe('INSUFFICIENT_ALLOWANCE')
    expect(err.message).toContain('200')
  })
})

describe('PolicyNotFoundError', () => {
  it('includes policyId in message', () => {
    const err = new PolicyNotFoundError('0xabc')
    expect(err.code).toBe('POLICY_NOT_FOUND')
    expect(err.message).toContain('0xabc')
  })
})

describe('PolicyNotActiveError', () => {
  it('includes policyId in message', () => {
    const err = new PolicyNotActiveError('0xdef')
    expect(err.code).toBe('POLICY_NOT_ACTIVE')
    expect(err.message).toContain('0xdef')
  })
})

describe('TransactionFailedError', () => {
  it('includes txHash', () => {
    const err = new TransactionFailedError('reverted', '0xtx1')
    expect(err.txHash).toBe('0xtx1')
    expect(err.code).toBe('TRANSACTION_FAILED')
  })

  it('works without txHash', () => {
    const err = new TransactionFailedError('reverted')
    expect(err.txHash).toBeUndefined()
  })
})

describe('BridgeQuoteError', () => {
  it('has correct code', () => {
    const err = new BridgeQuoteError('no route')
    expect(err.code).toBe('BRIDGE_QUOTE_FAILED')
  })
})

describe('BridgeExecutionError', () => {
  it('has sourceTxHash', () => {
    const err = new BridgeExecutionError('failed', '0xsrc')
    expect(err.sourceTxHash).toBe('0xsrc')
    expect(err.code).toBe('BRIDGE_EXECUTION_FAILED')
  })
})

describe('BridgeTimeoutError', () => {
  it('has sourceTxHash and correct code', () => {
    const err = new BridgeTimeoutError('0xsrc')
    expect(err.sourceTxHash).toBe('0xsrc')
    expect(err.code).toBe('BRIDGE_TIMEOUT')
    expect(err.message).toContain('0xsrc')
  })
})
