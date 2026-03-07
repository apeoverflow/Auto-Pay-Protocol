/**
 * Autonomous Sponsor Agent
 *
 * An AI agent that discovers common goods projects, evaluates their
 * funding needs, and autonomously subscribes to fund them via AutoPay.
 *
 * This demonstrates the agent economy applied to public goods funding:
 * an agent that depends on open-source infrastructure can autonomously
 * fund the projects it relies on — no human intervention required.
 *
 * Flow:
 *   1. Query the project registry for fundable projects
 *   2. Evaluate projects by category, funding gap, and dependency count
 *   3. Select a project and funding tier
 *   4. Subscribe via AutoPay (first charge is immediate)
 *   5. Access sponsor-only perks (build status, governance, etc.)
 *   6. Demonstrate portfolio management (check status, cancel if needed)
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... CHAIN=baseSepolia node sponsor-agent.js
 *
 * The agent wallet must hold:
 *   - USDC for subscription payments
 *   - Native token (ETH on Base, FLOW on Flow EVM) for gas
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
const log = (msg) => console.log(`  [sponsor-agent] ${msg}`)

// ── Agent Decision Logic ────────────────────────────────────────

/**
 * Score projects by funding need and ecosystem impact.
 * A real agent would use more sophisticated criteria — dependency
 * analysis, usage metrics, security audit status, etc.
 */
function scoreProject(project) {
  const fundingGap = 1 - project.fundingReceived / project.fundingGoal
  const impactScore = Math.log10(project.monthlyDownloads + 1) / 6
  const dependencyScore = Math.min(project.dependents / 1000, 1)

  return {
    project,
    score: fundingGap * 0.4 + impactScore * 0.35 + dependencyScore * 0.25,
    fundingGap: Math.round(fundingGap * 100),
    reasoning: [
      `${Math.round(fundingGap * 100)}% funding gap`,
      `${project.monthlyDownloads.toLocaleString()} monthly downloads`,
      `${project.dependents} dependent projects`,
    ],
  }
}

/**
 * Select the best funding tier based on agent budget.
 * Picks the highest tier the agent can afford while staying
 * within a reasonable spending cap (12 months).
 */
function selectTier(tiers, usdcBalance) {
  const balanceUsdc = Number(formatUnits(usdcBalance, 6))

  // Find the highest affordable tier (need at least 1 charge worth)
  const affordable = tiers
    .map((tier, index) => ({ ...tier, index }))
    .filter((tier) => Number(tier.amount) <= balanceUsdc)
    .sort((a, b) => Number(b.amount) - Number(a.amount))

  return affordable[0] || null
}

// ── Main Agent Loop ─────────────────────────────────────────────

async function main() {
  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║       AutoPay Sponsor Agent                           ║
  ║       Autonomous Common Goods Funding                 ║
  ╚═══════════════════════════════════════════════════════╝
  `)

  log(`Wallet:  ${agent.address}`)
  log(`Chain:   ${CHAIN} (${agent.chain.chainId})`)
  log(`Registry: ${REGISTRY_URL}`)

  // Show balances
  const usdcBal = await agent.getBalance()
  const gasBal = await agent.getGasBalance()
  log(`USDC balance:   ${formatUnits(usdcBal, 6)} USDC`)
  log(`Native balance: ${formatUnits(gasBal, 18)}`)

  if (gasBal === 0n) {
    log('No native token for gas — fund the agent wallet first')
    process.exit(1)
  }
  if (usdcBal === 0n) {
    log('No USDC balance — fund the agent wallet first')
    process.exit(1)
  }

  // ── Step 1: Discover projects ─────────────────────────────────
  console.log(`\n  ── Step 1: Discover common goods projects ──\n`)

  const projectsRes = await fetch(`${REGISTRY_URL}/api/projects`)
  if (!projectsRes.ok) {
    log(`Registry returned ${projectsRes.status}. Is it running?`)
    process.exit(1)
  }

  const { projects } = await projectsRes.json()
  log(`Found ${projects.length} fundable projects:`)
  for (const p of projects) {
    log(`  - ${p.name} (${p.category}) — ${p.percentFunded}% funded`)
  }

  // ── Step 2: Evaluate and rank projects ────────────────────────
  console.log(`\n  ── Step 2: Evaluate projects by funding need + impact ──\n`)

  const ranked = projects.map(scoreProject).sort((a, b) => b.score - a.score)

  for (const { project, score, reasoning } of ranked) {
    log(`  ${project.name}: score ${score.toFixed(3)}`)
    for (const r of reasoning) {
      log(`    - ${r}`)
    }
  }

  const topPick = ranked[0]
  log(`\n  Selected: "${topPick.project.name}" (highest combined score)`)

  // ── Step 3: Select funding tier ───────────────────────────────
  console.log(`\n  ── Step 3: Select funding tier ──\n`)

  // Fetch full project details to get tier pricing
  const detailRes = await fetch(`${REGISTRY_URL}/api/projects/${topPick.project.id}`)
  const projectDetail = await detailRes.json()

  const selectedTier = selectTier(projectDetail.tiers, usdcBal)
  if (!selectedTier) {
    log('Insufficient USDC for any funding tier')
    process.exit(1)
  }

  log(`Available tiers:`)
  for (const tier of projectDetail.tiers) {
    const marker = tier.name === selectedTier.name ? ' ← selected' : ''
    log(`  - ${tier.name}: ${tier.amount} USDC/month — ${tier.description}${marker}`)
  }

  // ── Step 4: Attempt sponsor-gated endpoint (expect 402) ──────
  console.log(`\n  ── Step 4: Attempt sponsor-only endpoint (expect 402) ──\n`)

  const gatedRes = await fetch(`${REGISTRY_URL}/api/projects/${topPick.project.id}/sponsors`)
  log(`GET /api/projects/${topPick.project.id}/sponsors → ${gatedRes.status}`)

  if (gatedRes.status === 402) {
    const discovery = await gatedRes.json()
    log(`Service requires: ${discovery.accepts.join(', ')}`)
    log(`Available plans: ${discovery.autopay.plans.length}`)
    log(`Merchant: ${discovery.autopay.merchant}`)
  }

  // ── Step 5: Subscribe to fund the project ─────────────────────
  console.log(`\n  ── Step 5: Subscribe to fund "${topPick.project.name}" ──\n`)

  const spendingCap = Number(selectedTier.amount) * 12 // 12-month cap
  log(`Subscribing: ${selectedTier.amount} USDC/month, cap ${spendingCap} USDC`)

  const { policyId, txHash } = await agent.subscribe({
    merchant: projectDetail.howToFund.merchant,
    amount: Number(selectedTier.amount),
    interval: selectedTier.interval,
    spendingCap,
  })

  log(`Subscription created!`)
  log(`  policyId: ${policyId}`)
  log(`  tier:     ${selectedTier.name}`)
  log(`  amount:   ${selectedTier.amount} USDC/month`)
  log(`  cap:      ${spendingCap} USDC (12 months)`)
  log(`  explorer: ${agent.chain.explorer}/tx/${txHash}`)

  // ── Step 6: Access sponsor perks ──────────────────────────────
  console.log(`\n  ── Step 6: Access sponsor-only perks ──\n`)

  const bearerToken = await agent.createBearerToken(policyId)
  const authHeaders = { Authorization: `Bearer ${bearerToken}` }

  // Fetch sponsor list
  const sponsorsRes = await fetch(
    `${REGISTRY_URL}/api/projects/${topPick.project.id}/sponsors`,
    { headers: authHeaders }
  )
  if (sponsorsRes.ok) {
    const sponsors = await sponsorsRes.json()
    log(`Sponsor list for ${topPick.project.name}:`)
    log(`  Total monthly funding: ${sponsors.totalMonthlyFunding}`)
    log(`  Funding goal: ${sponsors.fundingGoal}`)
    log(`  Progress: ${sponsors.percentFunded}%`)
    log(`  Active sponsors: ${sponsors.sponsors.length}`)
  }

  // Fetch build status
  const buildsRes = await fetch(
    `${REGISTRY_URL}/api/projects/${topPick.project.id}/builds`,
    { headers: authHeaders }
  )
  if (buildsRes.ok) {
    const builds = await buildsRes.json()
    log(`\n  Build status:`)
    for (const build of builds.builds) {
      const icon = build.status === 'passing' ? '+' : build.status === 'failing' ? 'x' : '~'
      log(`    [${icon}] ${build.branch} — ${build.status} (${build.duration})`)
    }
  }

  // Fetch governance
  const govRes = await fetch(
    `${REGISTRY_URL}/api/projects/${topPick.project.id}/governance`,
    { headers: authHeaders }
  )
  if (govRes.ok) {
    const gov = await govRes.json()
    log(`\n  Active governance proposals:`)
    for (const proposal of gov.activeProposals) {
      log(`    ${proposal.id}: "${proposal.title}" — ${proposal.status}`)
    }
  }

  // ── Step 7: Portfolio management — cancel subscription ────────
  console.log(`\n  ── Step 7: Portfolio management ──\n`)

  log(`Cancelling subscription to demonstrate lifecycle...`)
  await agent.unsubscribe(policyId)
  log(`Subscription cancelled`)

  // Invalidate service cache
  await fetch(`${REGISTRY_URL}/api/subscriptions/${policyId}`, { method: 'DELETE' })

  // Verify access is revoked
  const cancelToken = await agent.createBearerToken(policyId)
  const verifyRes = await fetch(
    `${REGISTRY_URL}/api/projects/${topPick.project.id}/sponsors`,
    { headers: { Authorization: `Bearer ${cancelToken}` } }
  )
  log(`Post-cancel access check → ${verifyRes.status} (expected 402)`)

  // ── Summary ───────────────────────────────────────────────────
  console.log(`
  ── Demo Summary ──

  This agent autonomously:
    1. Discovered ${projects.length} common goods projects from the registry
    2. Evaluated them by funding gap, download volume, and dependency count
    3. Selected "${topPick.project.name}" (score: ${topPick.score.toFixed(3)})
    4. Chose the "${selectedTier.name}" tier at ${selectedTier.amount} USDC/month
    5. Subscribed on-chain — first payment was immediate
    6. Accessed sponsor perks (build status, governance, sponsor list)
    7. Cancelled to demonstrate full lifecycle

  In production, an agent would:
    - Maintain a portfolio of funded projects
    - Rebalance based on usage, dependency changes, and funding gaps
    - Bridge USDC from any chain if the settlement chain runs low
    - Use the MCP server so LLM-based agents can do this via tool calls
  `)
}

main().catch((err) => {
  console.error('\n  [sponsor-agent] Fatal error:', err.message || err)
  process.exit(1)
})
