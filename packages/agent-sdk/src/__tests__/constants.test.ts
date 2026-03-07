import { describe, it, expect } from 'vitest'
import {
  intervals,
  PROTOCOL_FEE_BPS,
  USDC_DECIMALS,
  MIN_INTERVAL,
  MAX_INTERVAL,
} from '../constants'

describe('intervals', () => {
  it('hourly is 3600', () => {
    expect(intervals.hourly).toBe(3_600)
  })

  it('daily is 86400', () => {
    expect(intervals.daily).toBe(86_400)
  })

  it('weekly is 604800', () => {
    expect(intervals.weekly).toBe(604_800)
  })

  it('monthly is 2592000 (30 days)', () => {
    expect(intervals.monthly).toBe(2_592_000)
  })

  it('yearly is 31536000 (365 days)', () => {
    expect(intervals.yearly).toBe(31_536_000)
  })

  it('biweekly is 2 * weekly', () => {
    expect(intervals.biweekly).toBe(intervals.weekly * 2)
  })

  it('quarterly is 3 * monthly', () => {
    expect(intervals.quarterly).toBe(intervals.monthly * 3)
  })
})

describe('constants', () => {
  it('PROTOCOL_FEE_BPS is 250 (2.5%)', () => {
    expect(PROTOCOL_FEE_BPS).toBe(250)
  })

  it('USDC_DECIMALS is 6', () => {
    expect(USDC_DECIMALS).toBe(6)
  })

  it('MIN_INTERVAL is 60 (1 minute)', () => {
    expect(MIN_INTERVAL).toBe(60)
  })

  it('MAX_INTERVAL is 31536000 (365 days)', () => {
    expect(MAX_INTERVAL).toBe(31_536_000)
  })
})
