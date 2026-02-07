import { describe, it, expect } from 'vitest'
import { intervals, PROTOCOL_FEE_BPS, USDC_DECIMALS, MIN_INTERVAL, MAX_INTERVAL, chains } from '../src/constants'

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
  it('has polygon amoy config', () => {
    expect(chains.polygonAmoy.chainId).toBe(80002)
    expect(chains.polygonAmoy.cctpDomain).toBe(7)
  })

  it('has arbitrum sepolia config', () => {
    expect(chains.arbitrumSepolia.chainId).toBe(421614)
    expect(chains.arbitrumSepolia.cctpDomain).toBe(3)
  })

  it('has arc testnet config', () => {
    expect(chains.arcTestnet.chainId).toBe(1868)
    expect(chains.arcTestnet.cctpDomain).toBe(26)
  })
})
