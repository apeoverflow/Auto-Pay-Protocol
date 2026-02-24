import { describe, it, expect } from 'vitest'
import { intervals, PROTOCOL_FEE_BPS, USDC_DECIMALS, MIN_INTERVAL, MAX_INTERVAL, chains, DEFAULT_CHECKOUT_BASE_URL } from '../src/constants'

describe('intervals', () => {
  it('has correct preset values', () => {
    expect(intervals.minute).toBe(60)
    expect(intervals.weekly).toBe(604_800)
    expect(intervals.biweekly).toBe(1_209_600)
    expect(intervals.monthly).toBe(2_592_000)
    expect(intervals.quarterly).toBe(7_776_000)
    expect(intervals.yearly).toBe(31_536_000)
  })

  it('custom() calculates correctly', () => {
    expect(intervals.custom(14, 'days')).toBe(1_209_600)
    expect(intervals.custom(2, 'hours')).toBe(7_200)
    expect(intervals.custom(30, 'minutes')).toBe(1_800)
    expect(intervals.custom(3, 'months')).toBe(7_776_000)
    expect(intervals.custom(1, 'years')).toBe(31_536_000)
  })
})

describe('protocol constants', () => {
  it('has correct fee BPS', () => {
    expect(PROTOCOL_FEE_BPS).toBe(250)
  })

  it('has correct USDC decimals', () => {
    expect(USDC_DECIMALS).toBe(6)
  })

  it('has correct interval bounds', () => {
    expect(MIN_INTERVAL).toBe(60)
    expect(MAX_INTERVAL).toBe(31_536_000)
  })
})

describe('chains', () => {
  it('has flow evm config', () => {
    expect(chains.flowEvm.chainId).toBe(747)
    expect(chains.flowEvm.checkoutBaseUrl).toBe('https://flow.autopayprotocol.com')
    expect(chains.flowEvm.usdc).toBe('0xF1815bd50389c46847f0Bda824eC8da914045D14')
  })

  it('has base config', () => {
    expect(chains.base.chainId).toBe(8453)
    expect(chains.base.checkoutBaseUrl).toBe('https://autopayprotocol.com')
    expect(chains.base.usdc).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
  })

  it('has default checkout base URL', () => {
    expect(DEFAULT_CHECKOUT_BASE_URL).toBeTruthy()
  })
})
