/**
 * End-to-end test for the AutoPay Agent SDK.
 *
 * Tests: balance checks, swap (native→USDC), subscribe, getPolicy, unsubscribe.
 *
 * GUARDRAILS:
 *   - Max USDC spend: 0.01 USDC (hardcoded)
 *   - Spending cap on subscription = chargeAmount (single charge only, no recurring)
 *   - Balance assertions before and after every on-chain action
 *   - Abort immediately if any check fails
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... node test-agent.js
 *
 * Optional env:
 *   CHAIN=flowEvm              (default: flowEvm)
 *   MERCHANT_ADDRESS=0x...     (default: from .env)
 *   SKIP_SWAP=1                skip the native→USDC swap test
 *   SKIP_SUBSCRIBE=1           skip the subscribe/unsubscribe test
 */

import { AutoPayAgent } from '@autopayprotocol/agent-sdk'
import { formatUnits, parseUnits } from 'viem'

// ── Guardrails ─────────────────────────────────────────────────

const MAX_USDC_SPEND = 0.01        // absolute max USDC the test may spend
const SWAP_NATIVE_AMOUNT = 0.5     // swap enough native to cover 0.01 USDC subscription
const SUBSCRIBE_AMOUNT = 0.01      // subscription charge amount
const USDC_DECIMALS = 6
const NATIVE_DECIMALS = 18

// ── Config ─────────────────────────────────────────────────────

const CHAIN = process.env.CHAIN || 'flowEvm'
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY
const MERCHANT = process.env.MERCHANT_ADDRESS || '0x2B8b9182c1c3A9bEf4a60951D9B7F49420D12B9B'
const SKIP_SWAP = process.env.SKIP_SWAP === '1'
const SKIP_SUBSCRIBE = process.env.SKIP_SUBSCRIBE === '1'

if (!PRIVATE_KEY) {
  console.error('AGENT_PRIVATE_KEY env var is required')
  process.exit(1)
}

// ── Helpers ────────────────────────────────────────────────────

let passed = 0
let failed = 0
let skipped = 0

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.log(`  ✗ ${label}`)
    failed++
    throw new Error(`Assertion failed: ${label}`)
  }
}

function skip(label) {
  console.log(`  ⊘ ${label} (skipped)`)
  skipped++
}

function fmtUsdc(raw) {
  return formatUnits(raw, USDC_DECIMALS)
}

function fmtNative(raw) {
  return formatUnits(raw, NATIVE_DECIMALS)
}

// ── Tests ──────────────────────────────────────────────────────

async function main() {
  console.log(`\n  ╔═══════════════════════════════════════════╗`)
  console.log(`  ║   AutoPay Agent SDK — Integration Test    ║`)
  console.log(`  ║   Max USDC spend: ${MAX_USDC_SPEND} USDC              ║`)
  console.log(`  ╚═══════════════════════════════════════════╝\n`)

  const agent = new AutoPayAgent({
    privateKey: PRIVATE_KEY,
    chain: CHAIN,
  })

  console.log(`  Wallet:   ${agent.address}`)
  console.log(`  Chain:    ${agent.chain.name} (${agent.chain.chainId})`)
  console.log(`  Merchant: ${MERCHANT}\n`)

  // ── 1. Balance checks (read-only) ────────────────────────────

  console.log(`  ── 1. Balance checks ──\n`)

  const usdcBefore = await agent.getBalance()
  const gasBefore = await agent.getGasBalance()

  console.log(`  USDC:   ${fmtUsdc(usdcBefore)}`)
  console.log(`  Native: ${fmtNative(gasBefore)} ${agent.chain.nativeCurrency.symbol}\n`)

  assert(typeof usdcBefore === 'bigint', 'getBalance() returns bigint')
  assert(typeof gasBefore === 'bigint', 'getGasBalance() returns bigint')
  assert(gasBefore > 0n, 'Has native token for gas')

  // Guardrail: ensure we have enough USDC for the test but not checking minimum
  // since the swap test might provide the USDC we need
  const minUsdc = parseUnits(String(MAX_USDC_SPEND), USDC_DECIMALS)

  // ── 2. Swap native → USDC ────────────────────────────────────

  console.log(`\n  ── 2. Swap native → USDC (${SWAP_NATIVE_AMOUNT} ${agent.chain.nativeCurrency.symbol}) ──\n`)

  if (SKIP_SWAP) {
    skip('swapNativeToUsdc()')
  } else {
    // Guardrail: ensure we have enough native token
    const swapCost = parseUnits(String(SWAP_NATIVE_AMOUNT), NATIVE_DECIMALS)
    assert(gasBefore > swapCost, `Has enough native for swap (need ${SWAP_NATIVE_AMOUNT}, have ${fmtNative(gasBefore)})`)

    console.log(`  Swapping ${SWAP_NATIVE_AMOUNT} ${agent.chain.nativeCurrency.symbol} → USDC...`)

    const swapResult = await agent.swapNativeToUsdc({
      amount: SWAP_NATIVE_AMOUNT,
      slippage: 1, // 1% slippage for tiny amounts
      onStatus: (s) => console.log(`    status: ${s.step}`),
    })

    assert(swapResult.txHash.startsWith('0x'), 'swap txHash is valid hex')
    assert(Number(swapResult.usdcAmount) > 0, `Received USDC: ${swapResult.usdcAmount}`)
    assert(Number(swapResult.nativeAmount) > 0, `Spent native: ${swapResult.nativeAmount}`)
    assert(swapResult.durationMs > 0, `Duration: ${swapResult.durationMs}ms`)

    console.log(`  Explorer: ${agent.chain.explorer}/tx/${swapResult.txHash}`)

    // Verify balance changed
    const usdcAfterSwap = await agent.getBalance()
    assert(usdcAfterSwap > usdcBefore, `USDC increased: ${fmtUsdc(usdcBefore)} → ${fmtUsdc(usdcAfterSwap)}`)
  }

  // ── 3. Subscribe + getPolicy + unsubscribe ────────────────────

  console.log(`\n  ── 3. Subscribe (${SUBSCRIBE_AMOUNT} USDC) ──\n`)

  if (SKIP_SUBSCRIBE) {
    skip('subscribe()')
    skip('getPolicy()')
    skip('canCharge()')
    skip('unsubscribe()')
  } else {
    // Guardrail: re-check balance to ensure we can afford this
    const usdcNow = await agent.getBalance()
    assert(usdcNow >= minUsdc, `Has enough USDC (need ${MAX_USDC_SPEND}, have ${fmtUsdc(usdcNow)})`)

    // Guardrail: spending cap = charge amount → only 1 charge ever possible
    const spendingCap = SUBSCRIBE_AMOUNT
    assert(spendingCap <= MAX_USDC_SPEND, `Spending cap (${spendingCap}) <= max (${MAX_USDC_SPEND})`)

    console.log(`  Subscribing: ${SUBSCRIBE_AMOUNT} USDC, cap: ${spendingCap} USDC`)

    const sub = await agent.subscribe({
      merchant: MERCHANT,
      amount: SUBSCRIBE_AMOUNT,
      interval: 86400, // daily
      spendingCap,
    })

    assert(sub.policyId.startsWith('0x'), 'policyId is valid hex')
    assert(sub.txHash.startsWith('0x'), 'subscribe txHash is valid hex')
    console.log(`  policyId: ${sub.policyId}`)
    console.log(`  Explorer: ${agent.chain.explorer}/tx/${sub.txHash}`)

    // Guardrail: verify USDC spent matches expectations
    const usdcAfterSub = await agent.getBalance()
    const spent = usdcNow - usdcAfterSub
    const spentFormatted = Number(fmtUsdc(spent))
    console.log(`  USDC spent: ${fmtUsdc(spent)} (before: ${fmtUsdc(usdcNow)}, after: ${fmtUsdc(usdcAfterSub)})`)

    // Allow for protocol fee (2.5%) on top of charge amount
    const maxExpected = MAX_USDC_SPEND * 1.03 // 3% buffer for rounding
    assert(spentFormatted <= maxExpected, `Spent ${spentFormatted} USDC ≤ max ${maxExpected}`)

    // ── 3b. getPolicy ────────────────────────────────────────────

    console.log(`\n  ── 3b. Read policy on-chain ──\n`)

    const policy = await agent.getPolicy(sub.policyId)

    assert(policy.active === true, 'Policy is active')
    assert(policy.payer.toLowerCase() === agent.address.toLowerCase(), 'Payer matches agent')
    assert(policy.merchant.toLowerCase() === MERCHANT.toLowerCase(), 'Merchant matches')
    assert(policy.chargeAmount === parseUnits(String(SUBSCRIBE_AMOUNT), USDC_DECIMALS), 'Charge amount matches')
    assert(policy.interval === 86400, 'Interval is 86400s (daily)')
    assert(policy.chargeCount === 1, 'Charge count is 1 (first charge)')
    assert(policy.consecutiveFailures === 0, 'No failures')
    console.log(`  spendingCap: ${fmtUsdc(policy.spendingCap)} USDC`)
    console.log(`  totalSpent:  ${fmtUsdc(policy.totalSpent)} USDC`)

    // ── 3c. canCharge ────────────────────────────────────────────

    console.log(`\n  ── 3c. canCharge() ──\n`)

    const { ok, reason } = await agent.canCharge(sub.policyId)
    // Should NOT be chargeable — spending cap reached (cap = chargeAmount = single charge)
    console.log(`  canCharge: ${ok} — ${reason}`)
    assert(ok === false, `Cannot charge again (cap reached): ${reason}`)

    // ── 3d. createBearerToken ───────────────────────────────────

    console.log(`\n  ── 3d. Bearer token ──\n`)

    const token = await agent.createBearerToken(sub.policyId)
    const parts = token.split('.')
    assert(parts.length === 3, 'Token has 3 parts (policyId.expiry.signature)')
    assert(parts[0] === sub.policyId, 'Token contains policyId')
    assert(Number(parts[1]) > Math.floor(Date.now() / 1000), 'Token expiry is in the future')
    assert(parts[2].startsWith('0x'), 'Token signature is hex')
    console.log(`  Token: ${token.slice(0, 40)}...`)

    // ── 3e. Unsubscribe ──────────────────────────────────────────

    console.log(`\n  ── 3e. Unsubscribe ──\n`)

    const cancelHash = await agent.unsubscribe(sub.policyId)
    assert(cancelHash.startsWith('0x'), 'Unsubscribe txHash is valid hex')
    console.log(`  Explorer: ${agent.chain.explorer}/tx/${cancelHash}`)

    // Verify policy is now inactive
    const cancelledPolicy = await agent.getPolicy(sub.policyId)
    assert(cancelledPolicy.active === false, 'Policy is now inactive')

    // ── Final balance check ──────────────────────────────────────

    console.log(`\n  ── Final balance check ──\n`)

    const usdcFinal = await agent.getBalance()
    const totalSpent = usdcBefore - usdcFinal
    // totalSpent could be negative if swap added more than subscribe spent
    console.log(`  USDC start:  ${fmtUsdc(usdcBefore)}`)
    console.log(`  USDC final:  ${fmtUsdc(usdcFinal)}`)
    console.log(`  Net change:  ${totalSpent >= 0n ? '-' : '+'}${fmtUsdc(totalSpent >= 0n ? totalSpent : -totalSpent)} USDC`)
  }

  // ── Summary ──────────────────────────────────────────────────

  console.log(`\n  ══════════════════════════════════════════`)
  console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped`)
  console.log(`  ══════════════════════════════════════════\n`)

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(`\n  ✗ Fatal error: ${err.message || err}`)
  if (failed > 0) {
    console.log(`\n  Results: ${passed} passed, ${failed} failed, ${skipped} skipped\n`)
  }
  process.exit(1)
})
