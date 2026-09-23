import { describe, it, expect } from 'vitest'
import { decide, computeThresholdMicro, type MonitorConfig, type MonitorState, type MonitorObservation } from '../../src/monitors/state.js'

const CONFIG: MonitorConfig = {
  thresholdBps: 1000, // 10%
  backoffDays: [0, 3, 5, 15, 30, 30],
}

const NOW = new Date('2026-07-19T00:00:00.000Z')

/** Fresh, verified, opted-in payer with zero prior notifications. */
function baseState(overrides: Partial<MonitorState> = {}): MonitorState {
  return {
    notificationStage: 0,
    notificationsOptedOut: false,
    lowApprovalSince: null,
    nextNotificationAt: null,
    emailVerified: true,
    ...overrides,
  }
}

/** 100 USDC projection; caller specifies allowance. */
function observed(allowanceMicro: bigint, projectionMicro = 100_000_000n): MonitorObservation {
  return { currentAllowanceMicro: allowanceMicro, projected12moMicro: projectionMicro }
}

describe('computeThresholdMicro', () => {
  it('returns 10% for 1000bps', () => {
    expect(computeThresholdMicro(100_000_000n, 1000)).toBe(10_000_000n)
  })
  it('floors integer division', () => {
    expect(computeThresholdMicro(999n, 1000)).toBe(99n) // (999*1000)/10000 = 99
  })
  it('handles zero projection', () => {
    expect(computeThresholdMicro(0n, 1000)).toBe(0n)
  })
})

describe('decide — happy path (verified, opted in, at risk)', () => {
  it('first detection triggers stage-1 notify immediately (backoff[0]=0 → next fires now)', () => {
    // 5 USDC allowance against 100 USDC projection → 5% < 10% threshold
    const action = decide(baseState(), observed(5_000_000n), CONFIG, NOW)
    expect(action.kind).toBe('notify')
    if (action.kind !== 'notify') return
    expect(action.priorStage).toBe(0)
    expect(action.newStage).toBe(1)
    expect(action.lowApprovalSince).toEqual(NOW)
    expect(action.thresholdMicro).toBe(10_000_000n)
    // With backoffDays[0]=0, next notification is scheduled for NOW (immediately due next tick)
    expect(action.nextNotificationAt.getTime()).toBe(NOW.getTime())
  })

  it('cadence gate: nextNotificationAt in the future → noop even if at risk', () => {
    const future = new Date(NOW.getTime() + 3600_000)
    const s = baseState({ notificationStage: 1, lowApprovalSince: NOW, nextNotificationAt: future })
    const action = decide(s, observed(5_000_000n), CONFIG, NOW)
    expect(action.kind).toBe('noop')
  })

  it('stage advances 1 → 2 with backoff[1]=3 days', () => {
    const s = baseState({ notificationStage: 1, lowApprovalSince: NOW, nextNotificationAt: NOW })
    const action = decide(s, observed(5_000_000n), CONFIG, NOW)
    expect(action.kind).toBe('notify')
    if (action.kind !== 'notify') return
    expect(action.priorStage).toBe(1)
    expect(action.newStage).toBe(2)
    // backoffDays[1] = 3 days
    const expected = new Date(NOW.getTime() + 3 * 24 * 3600 * 1000)
    expect(action.nextNotificationAt).toEqual(expected)
    // lowApprovalSince preserved from prior state
    expect(action.lowApprovalSince).toEqual(NOW)
  })

  it('stage caps at maxStage (backoffDays.length)', () => {
    // At stage 6 (== length), advance should still cap at length
    const s = baseState({ notificationStage: 6, lowApprovalSince: NOW, nextNotificationAt: NOW })
    const action = decide(s, observed(5_000_000n), CONFIG, NOW)
    expect(action.kind).toBe('notify')
    if (action.kind !== 'notify') return
    expect(action.newStage).toBe(6) // capped at backoffDays.length
    // Uses the last backoff value (30 days) for the cadence
    const expected = new Date(NOW.getTime() + 30 * 24 * 3600 * 1000)
    expect(action.nextNotificationAt).toEqual(expected)
  })
})

describe('decide — recovery', () => {
  it('allowance climbs back above threshold while escalating → reset', () => {
    const s = baseState({ notificationStage: 3, lowApprovalSince: NOW })
    // 50 USDC allowance vs 100 USDC projection → 50% >> 10%
    const action = decide(s, observed(50_000_000n), CONFIG, NOW)
    expect(action.kind).toBe('reset')
    if (action.kind !== 'reset') return
    expect(action.priorStage).toBe(3)
  })

  it('allowance above threshold at stage 0 → noop (no email churn)', () => {
    const action = decide(baseState(), observed(50_000_000n), CONFIG, NOW)
    expect(action.kind).toBe('noop')
  })

  it('projection zero at stage > 0 → reset (payer cancelled all subs)', () => {
    const s = baseState({ notificationStage: 2 })
    const action = decide(s, observed(0n, 0n), CONFIG, NOW)
    expect(action.kind).toBe('reset')
  })

  it('projection zero at stage 0 → noop', () => {
    const action = decide(baseState(), observed(0n, 0n), CONFIG, NOW)
    expect(action.kind).toBe('noop')
  })
})

describe('decide — short-circuits', () => {
  it('opted out → noop regardless of allowance', () => {
    const s = baseState({ notificationsOptedOut: true, notificationStage: 2 })
    const action = decide(s, observed(0n), CONFIG, NOW)
    expect(action.kind).toBe('noop')
  })

  it('unverified email → noop even if at risk and never notified before', () => {
    const s = baseState({ emailVerified: false })
    const action = decide(s, observed(0n), CONFIG, NOW)
    expect(action.kind).toBe('noop')
  })
})

describe('decide — boundary cases', () => {
  it('allowance exactly at threshold is NOT low approval (strict <)', () => {
    const action = decide(baseState(), observed(10_000_000n), CONFIG, NOW)
    expect(action.kind).toBe('noop')
  })

  it('allowance one µUSDC below threshold IS low approval', () => {
    const action = decide(baseState(), observed(9_999_999n), CONFIG, NOW)
    expect(action.kind).toBe('notify')
  })

  it('supports fractional days for testing (backoff 0.001d ≈ 86s)', () => {
    const cfg: MonitorConfig = { thresholdBps: 1000, backoffDays: [0, 0.001] }
    const s = baseState({ notificationStage: 1, lowApprovalSince: NOW, nextNotificationAt: NOW })
    const action = decide(s, observed(0n), cfg, NOW)
    expect(action.kind).toBe('notify')
    if (action.kind !== 'notify') return
    const deltaMs = action.nextNotificationAt.getTime() - NOW.getTime()
    // 0.001 days = 86.4 seconds
    expect(deltaMs).toBe(Math.round(0.001 * 24 * 3600 * 1000))
  })
})
