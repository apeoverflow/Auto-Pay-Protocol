/**
 * DAO Treasury Automated Funder
 *
 * Demonstrates how a DAO treasury can programmatically fund multiple
 * common goods projects using AutoPay. The DAO allocates a monthly
 * budget across ecosystem dependencies with spending caps and reviews.
 *
 * This models a real scenario where Protocol Labs, Filecoin Foundation,
 * or any ecosystem fund wants to set up automated, recurring funding
 * for the open-source projects they depend on.
 *
 * Features demonstrated:
 *   - Multi-project funding from a single wallet
 *   - Budget allocation by category/priority
 *   - Spending caps for fiscal control
 *   - On-chain audit trail for all contributions
 *   - Cross-chain USDC bridging (when funds are on another chain)
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... MERCHANT_ADDRESS=0x... CHAIN=baseSepolia node dao-funder.js
 *
 * The wallet must hold USDC and native token for gas.
 */

import { AutoPayAgent } from '@autopayprotocol/agent-sdk'
import { formatUnits } from 'viem'

// ── Config ──────────────────────────────────────────────────────

const REGISTRY_URL = process.env.REGISTRY_URL || 'http://localhost:4100'
const CHAIN = process.env.CHAIN || 'baseSepolia'
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY

if (!PRIVATE_KEY) {
  console.error('AGENT_PRIVATE_KEY env var is required')
  process.exit(1)
}

const agent = new AutoPayAgent({ privateKey: PRIVATE_KEY, chain: CHAIN })
const log = (msg) => console.log(`  [dao-funder] ${msg}`)

// ── DAO Funding Policy ──────────────────────────────────────────

/**
 * The DAO's funding allocation policy.
 *
 * In production this would come from a governance vote or
 * multisig-approved configuration. Here we define it statically
 * to demonstrate the mechanics.
 */
const FUNDING_POLICY = {
  name: 'Protocol Labs Ecosystem Fund — Q2 2026',
  totalMonthlyBudget: 500, // USDC per month
  maxPerProject: 200,       // No single project gets more than this
  quarterlyCapMultiplier: 3, // 3 months of spending cap per subscription
  categoryWeights: {
    infrastructure: 0.35,
    'data-layer': 0.25,
    storage: 0.25,
    cryptography: 0.15,
  },
  // Fund at the Sustainer tier by default, Champion for high-priority
  defaultTier: 'Sustainer',
  highPriorityCategories: ['infrastructure', 'storage'],
}

// ── Budget Allocation Logic ─────────────────────────────────────

function allocateBudget(projects, policy) {
  const allocations = []
  let remainingBudget = policy.totalMonthlyBudget

  for (const project of projects) {
    const categoryWeight = policy.categoryWeights[project.category] || 0.1
    const fundingGap = 1 - project.fundingReceived / project.fundingGoal

    // Higher allocation for underfunded projects in weighted categories
    let allocation = Math.round(policy.totalMonthlyBudget * categoryWeight * fundingGap)
    allocation = Math.min(allocation, policy.maxPerProject, remainingBudget)

    if (allocation <= 0) continue

    // Select tier based on allocation amount and priority
    const isHighPriority = policy.highPriorityCategories.includes(project.category)
    const targetTier = isHighPriority ? 'Champion' : policy.defaultTier

    // Find the closest tier that fits within allocation
    const selectedTier =
      project.tiers.find((t) => t.name === targetTier && Number(t.amount) <= allocation) ||
      project.tiers.filter((t) => Number(t.amount) <= allocation).sort((a, b) => Number(b.amount) - Number(a.amount))[0]

    if (!selectedTier) continue

    const amount = Number(selectedTier.amount)
    const spendingCap = amount * policy.quarterlyCapMultiplier

    allocations.push({
      project,
      tier: selectedTier,
      monthlyAmount: amount,
      spendingCap,
      reasoning: [
        `Category: ${project.category} (weight: ${categoryWeight})`,
        `Funding gap: ${Math.round(fundingGap * 100)}%`,
        `Priority: ${isHighPriority ? 'high' : 'standard'}`,
      ],
    })

    remainingBudget -= amount
  }

  return {
    allocations,
    totalAllocated: policy.totalMonthlyBudget - remainingBudget,
    remainingBudget,
  }
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║       DAO Treasury Automated Funder                   ║
  ║       Common Goods Ecosystem Funding                  ║
  ╚═══════════════════════════════════════════════════════╝
  `)

  log(`Wallet:       ${agent.address}`)
  log(`Chain:        ${CHAIN} (${agent.chain.chainId})`)
  log(`Fund:         ${FUNDING_POLICY.name}`)
  log(`Monthly budget: ${FUNDING_POLICY.totalMonthlyBudget} USDC`)

  // Show balances
  const usdcBal = await agent.getBalance()
  const gasBal = await agent.getGasBalance()
  log(`USDC balance: ${formatUnits(usdcBal, 6)} USDC`)
  log(`Gas balance:  ${formatUnits(gasBal, 18)}`)

  if (gasBal === 0n) {
    log('No native token for gas — fund the treasury wallet first')
    process.exit(1)
  }
  if (usdcBal === 0n) {
    log('No USDC balance — fund the treasury wallet first')
    process.exit(1)
  }

  // ── Step 1: Fetch project registry ────────────────────────────
  console.log(`\n  ── Step 1: Fetch ecosystem project registry ──\n`)

  const projectsRes = await fetch(`${REGISTRY_URL}/api/projects`)
  if (!projectsRes.ok) {
    log(`Registry returned ${projectsRes.status}. Is it running?`)
    process.exit(1)
  }

  const { projects } = await projectsRes.json()
  log(`Found ${projects.length} projects in the registry`)

  // Fetch full details for each project (to get tier pricing)
  const fullProjects = []
  for (const p of projects) {
    const res = await fetch(`${REGISTRY_URL}/api/projects/${p.id}`)
    fullProjects.push(await res.json())
  }

  // ── Step 2: Compute budget allocation ─────────────────────────
  console.log(`\n  ── Step 2: Compute funding allocation ──\n`)

  const { allocations, totalAllocated, remainingBudget } = allocateBudget(
    fullProjects,
    FUNDING_POLICY
  )

  log(`Budget allocation (${FUNDING_POLICY.name}):`)
  log(`  Total budget:    ${FUNDING_POLICY.totalMonthlyBudget} USDC/month`)
  log(`  Allocated:       ${totalAllocated} USDC/month`)
  log(`  Remaining:       ${remainingBudget} USDC/month`)
  log('')

  for (const alloc of allocations) {
    log(`  ${alloc.project.name}`)
    log(`    Tier:     ${alloc.tier.name} (${alloc.monthlyAmount} USDC/month)`)
    log(`    Cap:      ${alloc.spendingCap} USDC (${FUNDING_POLICY.quarterlyCapMultiplier} months)`)
    for (const r of alloc.reasoning) {
      log(`    - ${r}`)
    }
    log('')
  }

  // ── Step 3: Execute subscriptions ─────────────────────────────
  console.log(`  ── Step 3: Execute funding subscriptions ──\n`)

  const subscriptions = []
  const balanceUsdc = Number(formatUnits(usdcBal, 6))

  // Check if we have enough USDC for all allocations
  const totalNeeded = allocations.reduce((sum, a) => sum + a.monthlyAmount, 0)
  if (totalNeeded > balanceUsdc) {
    log(`Insufficient USDC: need ${totalNeeded}, have ${balanceUsdc.toFixed(2)}`)
    log(`Funding only what we can afford...`)
  }

  let totalFunded = 0
  for (const alloc of allocations) {
    const currentBalance = Number(formatUnits(await agent.getBalance(), 6))
    if (currentBalance < alloc.monthlyAmount) {
      log(`Skipping ${alloc.project.name} — insufficient balance (${currentBalance.toFixed(2)} USDC remaining)`)
      continue
    }

    log(`Subscribing to ${alloc.project.name}...`)

    try {
      const { policyId, txHash } = await agent.subscribe({
        merchant: alloc.project.howToFund.merchant,
        amount: alloc.monthlyAmount,
        interval: alloc.tier.interval,
        spendingCap: alloc.spendingCap,
      })

      subscriptions.push({
        project: alloc.project.name,
        projectId: alloc.project.id,
        tier: alloc.tier.name,
        amount: alloc.monthlyAmount,
        policyId,
        txHash,
      })

      totalFunded += alloc.monthlyAmount
      log(`  policyId: ${policyId}`)
      log(`  tx: ${agent.chain.explorer}/tx/${txHash}`)
      log('')
    } catch (err) {
      log(`  Failed: ${err.message}`)
      log('')
    }
  }

  // ── Step 4: Verify access to sponsor perks ────────────────────
  console.log(`  ── Step 4: Verify sponsor access across portfolio ──\n`)

  for (const sub of subscriptions) {
    const token = await agent.createBearerToken(sub.policyId)
    const res = await fetch(`${REGISTRY_URL}/api/projects/${sub.projectId}/sponsors`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const statusIcon = res.ok ? '+' : 'x'
    log(`  [${statusIcon}] ${sub.project} (${sub.tier}) → ${res.status}`)
  }

  // ── Step 5: Clean up — cancel all subscriptions ───────────────
  console.log(`\n  ── Step 5: Clean up (cancel all for demo) ──\n`)

  for (const sub of subscriptions) {
    try {
      await agent.unsubscribe(sub.policyId)
      await fetch(`${REGISTRY_URL}/api/subscriptions/${sub.policyId}`, { method: 'DELETE' })
      log(`Cancelled: ${sub.project}`)
    } catch (err) {
      log(`Cancel failed for ${sub.project}: ${err.message}`)
    }
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log(`
  ── DAO Funding Summary ──

  Fund:            ${FUNDING_POLICY.name}
  Projects funded: ${subscriptions.length} / ${allocations.length}
  Total allocated: ${totalFunded} USDC/month
  Spending caps:   ${subscriptions.reduce((s, sub) => s + sub.amount * FUNDING_POLICY.quarterlyCapMultiplier, 0)} USDC total

  On-chain audit trail:
${subscriptions.map((s) => `    ${s.project}: ${agent.chain.explorer}/tx/${s.txHash}`).join('\n')}

  Key advantages for DAO treasuries:
    - Non-custodial: USDC stays in the treasury until each charge
    - Spending caps: On-chain enforcement prevents overspend
    - Transparent: Every contribution is on-chain and auditable
    - Automated: Relayer handles renewals — no manual intervention
    - Composable: Any project can add an AutoPay funding endpoint
    - Multi-chain: Bridge from any chain if treasury is on Ethereum/Arbitrum/etc.
    - Low fees: 2.5% vs 15-30% grants administration overhead
  `)
}

main().catch((err) => {
  console.error('\n  [dao-funder] Fatal error:', err.message || err)
  process.exit(1)
})
