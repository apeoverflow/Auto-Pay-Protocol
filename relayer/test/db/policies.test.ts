import { describe, it, expect } from 'vitest'
import { decideSpendingCapUpdate } from '../../src/db/policies.js'
import type { PolicyRow } from '../../src/types.js'

// Anchor every Date to a fixed instant so resume-on-raise's nextChargeAt math
// is deterministic. Vitest doesn't use real time here either way.
const T0 = new Date('2026-01-01T00:00:00Z')
const HOUR = 3600 * 1000

function buildPolicy(overrides: Partial<PolicyRow> = {}): PolicyRow {
  return {
    id: '0xabc',
    chain_id: 8453,
    payer: '0xpayer',
    merchant: '0xmerchant',
    charge_amount: '10000',          // $0.01 USDC
    spending_cap: '120000',          // $0.12 USDC
    total_spent: '10000',            // $0.01 already charged
    interval_seconds: 3600,          // 1h
    last_charged_at: T0,
    next_charge_at: new Date(T0.getTime() + HOUR),
    charge_count: 1,
    active: true,
    metadata_url: null,
    created_at: T0,
    ended_at: null,
    created_block: 100,
    created_tx: '0xtx',
    consecutive_failures: 0,
    last_failure_reason: null,
    cancelled_by_failure: false,
    cancelled_at: null,
    plan_id: null,
    plan_merchant: null,
    ...overrides,
  }
}

describe('decideSpendingCapUpdate', () => {
  // ---- No-op path -----------------------------------------------------------

  it('returns noop when the policy is not in the DB', () => {
    expect(decideSpendingCapUpdate(null, 200000n)).toEqual({ kind: 'noop' })
  })

  // ---- Plain update on active policies --------------------------------------

  it('updates cap only on an active policy when raising', () => {
    const policy = buildPolicy({ spending_cap: '120000', total_spent: '10000' })
    expect(decideSpendingCapUpdate(policy, 240000n)).toEqual({ kind: 'update-cap' })
  })

  it('updates cap only on an active policy when lowering', () => {
    const policy = buildPolicy({ spending_cap: '120000', total_spent: '10000' })
    expect(decideSpendingCapUpdate(policy, 80000n)).toEqual({ kind: 'update-cap' })
  })

  it('updates cap only on an active policy going to unlimited', () => {
    const policy = buildPolicy()
    expect(decideSpendingCapUpdate(policy, 0n)).toEqual({ kind: 'update-cap' })
  })

  // ---- Resume on raise (DB-completed → chargeable again) --------------------

  it('resumes a DB-completed policy when newCap > totalSpent', () => {
    const policy = buildPolicy({
      active: false,
      ended_at: new Date(T0.getTime() + 5 * HOUR),
      total_spent: '120000',
      spending_cap: '120000',
      last_charged_at: new Date(T0.getTime() + 5 * HOUR),
      interval_seconds: 3600,
    })
    const result = decideSpendingCapUpdate(policy, 240000n)
    expect(result.kind).toBe('resume')
    if (result.kind === 'resume') {
      // lastCharged + interval = T0 + 5h + 1h = T0 + 6h
      expect(result.nextChargeAt.toISOString()).toBe(new Date(T0.getTime() + 6 * HOUR).toISOString())
    }
  })

  it('resumes a DB-completed policy when newCap is 0 (unlimited)', () => {
    const policy = buildPolicy({
      active: false,
      ended_at: new Date(T0.getTime() + 5 * HOUR),
      total_spent: '120000',
      spending_cap: '120000',
      last_charged_at: new Date(T0.getTime() + 5 * HOUR),
      interval_seconds: 3600,
    })
    const result = decideSpendingCapUpdate(policy, 0n)
    expect(result.kind).toBe('resume')
  })

  it('falls back to created_at when last_charged_at is null on resume', () => {
    const created = new Date(T0.getTime() + 10 * HOUR)
    const policy = buildPolicy({
      active: false,
      ended_at: created,
      total_spent: '10000',
      spending_cap: '10000',
      last_charged_at: null,
      created_at: created,
      interval_seconds: 3600,
    })
    const result = decideSpendingCapUpdate(policy, 50000n)
    expect(result.kind).toBe('resume')
    if (result.kind === 'resume') {
      expect(result.nextChargeAt.toISOString()).toBe(new Date(created.getTime() + HOUR).toISOString())
    }
  })

  it('does not resume when the new cap still leaves the policy at-or-over its spend', () => {
    const policy = buildPolicy({
      active: false,
      ended_at: new Date(T0.getTime() + 5 * HOUR),
      total_spent: '120000',
      spending_cap: '120000',
    })
    // newCap === totalSpent → still not chargeable; cap-only update.
    expect(decideSpendingCapUpdate(policy, 120000n)).toEqual({ kind: 'update-cap' })
    // newCap < totalSpent → still not chargeable; cap-only update.
    expect(decideSpendingCapUpdate(policy, 50000n)).toEqual({ kind: 'update-cap' })
  })

  // ---- Failure-cancelled policies must never reactivate ---------------------

  it('does not reactivate a failure-cancelled policy even if newCap would be chargeable', () => {
    const policy = buildPolicy({
      active: false,
      cancelled_by_failure: true,
      cancelled_at: new Date(T0.getTime() + 3 * HOUR),
      ended_at: new Date(T0.getTime() + 3 * HOUR),
      total_spent: '50000',
      spending_cap: '120000',
    })
    expect(decideSpendingCapUpdate(policy, 240000n)).toEqual({ kind: 'update-cap' })
    expect(decideSpendingCapUpdate(policy, 0n)).toEqual({ kind: 'update-cap' })
  })

  // ---- Resume due-immediately edge -----------------------------------------

  it('produces a nextChargeAt that may be in the past when the policy was overdue', () => {
    // A sub completed long ago. lastCharged + interval ends up "in the past"
    // relative to now; the executor query is `next_charge_at <= NOW()` so this
    // is the desired behaviour ("due immediately on resume").
    const lastCharged = new Date('2026-01-15T00:00:00Z')
    const policy = buildPolicy({
      active: false,
      ended_at: lastCharged,
      total_spent: '10000',
      spending_cap: '10000',
      last_charged_at: lastCharged,
      interval_seconds: 86400, // 1 day
    })
    const result = decideSpendingCapUpdate(policy, 100000n)
    expect(result.kind).toBe('resume')
    if (result.kind === 'resume') {
      expect(result.nextChargeAt.toISOString()).toBe('2026-01-16T00:00:00.000Z')
    }
  })
})
