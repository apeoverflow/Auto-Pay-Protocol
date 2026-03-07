import { describe, it, expect } from 'vitest'
import { AutoPayAgent, PolicyNotFoundError } from '../../src/index'

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined
const MERCHANT = '0x2B8b9182c1c3A9bEf4a60951D9B7F49420D12B9B' as const
const CHAIN = 'flowEvm' as const

function createAgent() {
  return new AutoPayAgent({
    privateKey: PRIVATE_KEY!,
    chain: CHAIN,
  })
}

describe.skipIf(!PRIVATE_KEY)('Agent SDK Integration (Flow EVM)', () => {
  // ── Read-only tests ───────────────────────────────────────────

  it('getBalance() returns a positive USDC balance', async () => {
    const agent = createAgent()
    const balance = await agent.getBalance()
    expect(typeof balance).toBe('bigint')
    expect(balance).toBeGreaterThan(0n)
  })

  it('getGasBalance() returns a positive native balance', async () => {
    const agent = createAgent()
    const gas = await agent.getGasBalance()
    expect(typeof gas).toBe('bigint')
    expect(gas).toBeGreaterThan(0n)
  })

  it('createBearerToken() produces a valid 3-part token', async () => {
    const agent = createAgent()
    // Use a dummy policyId — the token is signed off-chain, no contract call
    const dummyPolicyId = '0x' + '01'.repeat(32) as `0x${string}`
    const token = await agent.createBearerToken(dummyPolicyId, 300)

    const parts = token.split('.')
    expect(parts).toHaveLength(3)

    // Part 1: policyId
    expect(parts[0]).toBe(dummyPolicyId)

    // Part 2: expiry timestamp (in the future)
    const expiry = Number(parts[1])
    const now = Math.floor(Date.now() / 1000)
    expect(expiry).toBeGreaterThan(now)
    expect(expiry).toBeLessThanOrEqual(now + 300 + 5) // allow small drift

    // Part 3: signature (0x-prefixed hex)
    expect(parts[2]).toMatch(/^0x[0-9a-fA-F]+$/)
  })

  // ── Error cases ───────────────────────────────────────────────

  it('constructor throws on unknown chain', () => {
    expect(() => new AutoPayAgent({
      privateKey: PRIVATE_KEY!,
      chain: 'unknownChain' as any,
    })).toThrow('Unknown chain')
  })

  it('getPolicy() with zero policyId throws PolicyNotFoundError', async () => {
    const agent = createAgent()
    const zeroPolicyId = '0x' + '00'.repeat(32) as `0x${string}`
    await expect(agent.getPolicy(zeroPolicyId)).rejects.toThrow(PolicyNotFoundError)
  })

  // ── Approve ───────────────────────────────────────────────────

  it('approveUsdc() returns a valid tx hash', async () => {
    const agent = createAgent()
    // Approve a tiny amount (1 USDC raw unit = 0.000001 USDC)
    const txHash = await agent.approveUsdc(1n)
    expect(txHash).toMatch(/^0x[0-9a-fA-F]{64}$/)
  })

  // ── Full lifecycle: subscribe → getPolicy → canCharge → unsubscribe ──

  it('subscribe + getPolicy + unsubscribe lifecycle', async ({ skip }) => {
    const agent = createAgent()

    // Guard: skip if wallet doesn't have enough USDC (tests consume balance)
    const balance = await agent.getBalance()
    if (balance < 1_000n) {
      console.warn(`Skipping subscribe test — wallet has ${balance} raw USDC, need ≥1000`)
      skip()
    }

    // Subscribe: 0.001 USDC, spendingCap = chargeAmount (single charge only)
    const sub = await agent.subscribe({
      merchant: MERCHANT,
      amount: 0.001,
      interval: 'monthly',
      spendingCap: 0.001, // cap = chargeAmount → only 1 charge ever
    })

    expect(sub.policyId).toMatch(/^0x[0-9a-fA-F]{64}$/)
    expect(sub.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/)

    // Read on-chain policy
    const policy = await agent.getPolicy(sub.policyId)
    expect(policy.active).toBe(true)
    expect(policy.payer.toLowerCase()).toBe(agent.address.toLowerCase())
    expect(policy.merchant.toLowerCase()).toBe(MERCHANT.toLowerCase())
    expect(policy.chargeCount).toBe(1) // first charge happened on creation
    expect(policy.chargeAmount).toBe(1_000n) // 0.001 USDC = 10000 raw
    expect(policy.spendingCap).toBe(1_000n)

    // canCharge should be false (cap reached or too soon — either way, not chargeable)
    const { ok } = await agent.canCharge(sub.policyId)
    expect(ok).toBe(false)

    // Unsubscribe
    const revokeTx = await agent.unsubscribe(sub.policyId)
    expect(revokeTx).toMatch(/^0x[0-9a-fA-F]{64}$/)

    // Verify policy is now inactive
    const revokedPolicy = await agent.getPolicy(sub.policyId)
    expect(revokedPolicy.active).toBe(false)
  })
})
