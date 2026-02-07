import { describe, it, expect } from 'vitest'
import { formatUSDC, parseUSDC, calculateFeeBreakdown, formatInterval } from '../src/amounts'

describe('formatUSDC', () => {
  it('formats whole numbers', () => {
    expect(formatUSDC('10000000')).toBe('10.00')
    expect(formatUSDC('1000000')).toBe('1.00')
  })

  it('formats fractional amounts', () => {
    expect(formatUSDC('9990000')).toBe('9.99')
    expect(formatUSDC('100000')).toBe('0.10')
    expect(formatUSDC('1000')).toBe('0.001')
  })

  it('formats zero', () => {
    expect(formatUSDC('0')).toBe('0.00')
  })
})

describe('parseUSDC', () => {
  it('converts human-readable to raw', () => {
    expect(parseUSDC(9.99)).toBe('9990000')
    expect(parseUSDC(0.10)).toBe('100000')
    expect(parseUSDC(1)).toBe('1000000')
    expect(parseUSDC(100)).toBe('100000000')
  })

  it('handles zero', () => {
    expect(parseUSDC(0)).toBe('0')
  })
})

describe('calculateFeeBreakdown', () => {
  it('calculates 2.5% fee correctly', () => {
    const result = calculateFeeBreakdown('10000000') // 10 USDC
    expect(result.total).toBe('10.00')
    expect(result.protocolFee).toBe('0.25')
    expect(result.merchantReceives).toBe('9.75')
    expect(result.feePercentage).toBe('2.5%')
  })

  it('calculates fee for $9.99', () => {
    const result = calculateFeeBreakdown('9990000')
    expect(result.total).toBe('9.99')
    // 9990000 * 250 / 10000 = 249750
    expect(result.protocolFee).toBe('0.24975')
  })

  it('handles small amounts', () => {
    const result = calculateFeeBreakdown('100000') // 0.10 USDC
    expect(result.total).toBe('0.10')
  })
})

describe('formatInterval', () => {
  it('returns preset names for known intervals', () => {
    expect(formatInterval(604_800)).toBe('weekly')
    expect(formatInterval(1_209_600)).toBe('biweekly')
    expect(formatInterval(2_592_000)).toBe('monthly')
    expect(formatInterval(7_776_000)).toBe('quarterly')
    expect(formatInterval(31_536_000)).toBe('yearly')
  })

  it('formats days', () => {
    expect(formatInterval(86400)).toBe('1 day')
    expect(formatInterval(172800)).toBe('2 days')
  })

  it('formats hours', () => {
    expect(formatInterval(3600)).toBe('1 hour')
    expect(formatInterval(7200)).toBe('2 hours')
  })

  it('formats minutes', () => {
    expect(formatInterval(60)).toBe('1 minute')
    expect(formatInterval(300)).toBe('5 minutes')
  })

  it('formats mixed days + hours', () => {
    expect(formatInterval(90000)).toBe('1d 1h')
  })

  it('formats raw seconds', () => {
    expect(formatInterval(30)).toBe('30s')
  })
})
