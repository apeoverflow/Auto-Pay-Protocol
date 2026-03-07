/**
 * Common Goods Project Registry
 *
 * A service that lists fundable common goods projects and gates sponsor
 * perks behind AutoPay subscriptions. When an agent or user requests
 * sponsor-only resources without a subscription, the service returns
 * HTTP 402 with funding plans — enabling autonomous discovery and funding.
 *
 * This demonstrates how open-source projects, public datasets, and
 * decentralized infrastructure can accept recurring crypto funding
 * from both humans and AI agents.
 *
 * Usage:
 *   MERCHANT_ADDRESS=0x... node project-registry.js
 *
 * Endpoints:
 *   GET  /api/status                 → public health check
 *   GET  /api/projects               → public project directory
 *   GET  /api/projects/:id           → public project details
 *   GET  /api/projects/:id/sponsors  → requires subscription (sponsor perks)
 *   GET  /api/projects/:id/builds    → requires subscription (build status feed)
 *   GET  /api/projects/:id/governance → requires subscription (governance data)
 *   DELETE /api/subscriptions/:id    → invalidate subscription cache
 */

import express from 'express'
import { requireSubscription, chains } from '@autopayprotocol/middleware'

// ── Config ──────────────────────────────────────────────────────

const CHAIN = process.env.CHAIN || 'baseSepolia'
const PORT = Number(process.env.REGISTRY_PORT) || 4100
const MERCHANT = process.env.MERCHANT_ADDRESS

if (!MERCHANT) {
  console.error('MERCHANT_ADDRESS env var is required')
  process.exit(1)
}

if (!chains[CHAIN]) {
  console.error(`Unknown chain: ${CHAIN}. Use: ${Object.keys(chains).join(', ')}`)
  process.exit(1)
}

// ── Sample Common Goods Projects ────────────────────────────────

const PROJECTS = [
  {
    id: 'libp2p-js',
    name: 'libp2p (JavaScript)',
    description: 'Modular peer-to-peer networking stack for the decentralized web',
    category: 'infrastructure',
    maintainers: ['Protocol Labs', 'ChainSafe'],
    repository: 'https://github.com/libp2p/js-libp2p',
    license: 'Apache-2.0 / MIT',
    monthlyDownloads: 284000,
    dependents: 1200,
    fundingGoal: 5000,
    fundingReceived: 1250,
    tiers: [
      {
        name: 'Supporter',
        amount: '5',
        interval: 2592000,
        description: 'Name in SPONSORS.md + build status webhook',
      },
      {
        name: 'Sustainer',
        amount: '25',
        interval: 2592000,
        description: 'Priority issue triage + private Discord channel',
      },
      {
        name: 'Champion',
        amount: '100',
        interval: 2592000,
        description: 'Governance vote + roadmap input + dedicated support',
      },
    ],
  },
  {
    id: 'ipfs-unixfs',
    name: 'IPFS UnixFS',
    description: 'Data format for representing files and directories in IPFS',
    category: 'data-layer',
    maintainers: ['Protocol Labs'],
    repository: 'https://github.com/ipfs/js-ipfs-unixfs',
    license: 'Apache-2.0 / MIT',
    monthlyDownloads: 156000,
    dependents: 430,
    fundingGoal: 3000,
    fundingReceived: 800,
    tiers: [
      {
        name: 'Supporter',
        amount: '5',
        interval: 2592000,
        description: 'Name in SPONSORS.md + build status webhook',
      },
      {
        name: 'Sustainer',
        amount: '25',
        interval: 2592000,
        description: 'Priority issue triage + quarterly impact report',
      },
    ],
  },
  {
    id: 'filecoin-storage',
    name: 'Filecoin Storage Provider Tools',
    description: 'Open-source tooling for Filecoin storage providers',
    category: 'storage',
    maintainers: ['Protocol Labs', 'Filecoin Foundation'],
    repository: 'https://github.com/filecoin-project/lotus',
    license: 'Apache-2.0 / MIT',
    monthlyDownloads: 89000,
    dependents: 210,
    fundingGoal: 10000,
    fundingReceived: 3200,
    tiers: [
      {
        name: 'Supporter',
        amount: '10',
        interval: 2592000,
        description: 'Sponsor badge + monthly storage report',
      },
      {
        name: 'Sustainer',
        amount: '50',
        interval: 2592000,
        description: 'Priority support + storage analytics dashboard',
      },
      {
        name: 'Champion',
        amount: '200',
        interval: 2592000,
        description: 'Governance vote + dedicated storage allocation advisory',
      },
    ],
  },
  {
    id: 'drand-beacon',
    name: 'drand Randomness Beacon',
    description: 'Distributed randomness beacon — verifiable, unpredictable, and unbiased',
    category: 'cryptography',
    maintainers: ['Protocol Labs', 'drand team'],
    repository: 'https://github.com/drand/drand',
    license: 'Apache-2.0',
    monthlyDownloads: 42000,
    dependents: 85,
    fundingGoal: 4000,
    fundingReceived: 600,
    tiers: [
      {
        name: 'Supporter',
        amount: '5',
        interval: 2592000,
        description: 'Sponsor badge + beacon uptime alerts',
      },
      {
        name: 'Sustainer',
        amount: '30',
        interval: 2592000,
        description: 'Priority API access + custom entropy feeds',
      },
    ],
  },
]

// ── Middleware ───────────────────────────────────────────────────

// Create tiered subscription guards — one per funding tier
function createTierGuard(minTierIndex) {
  // Use the lowest tier's amount as the minimum
  const lowestTier = PROJECTS[0].tiers[minTierIndex] || PROJECTS[0].tiers[0]

  return requireSubscription({
    merchant: MERCHANT,
    chain: CHAIN,
    plans: PROJECTS.flatMap((p) =>
      p.tiers.map((tier) => ({
        name: `${p.name} — ${tier.name}`,
        amount: tier.amount,
        interval: tier.interval,
        description: tier.description,
      }))
    ),
  })
}

const sponsorAuth = createTierGuard(0)

// ── Mock Sponsor Perks Data ─────────────────────────────────────

function generateBuildStatus(projectId) {
  const statuses = ['passing', 'passing', 'passing', 'failing', 'pending']
  const branches = ['main', 'develop', 'feat/v2', 'fix/perf']
  return {
    projectId,
    builds: branches.map((branch) => ({
      branch,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      commit: Math.random().toString(36).slice(2, 10),
      timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      duration: `${Math.floor(Math.random() * 300) + 30}s`,
    })),
    generatedAt: new Date().toISOString(),
  }
}

function generateGovernanceData(projectId) {
  return {
    projectId,
    activeProposals: [
      {
        id: 'PROP-042',
        title: 'Migrate to new transport layer',
        status: 'voting',
        votesFor: 34,
        votesAgainst: 8,
        deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
      },
      {
        id: 'PROP-043',
        title: 'Add WebRTC browser support',
        status: 'discussion',
        comments: 18,
        deadline: new Date(Date.now() + 14 * 86400000).toISOString(),
      },
    ],
    recentDecisions: [
      {
        id: 'PROP-041',
        title: 'Adopt new error handling standard',
        outcome: 'approved',
        date: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
    ],
    generatedAt: new Date().toISOString(),
  }
}

function generateSponsorList(projectId) {
  const project = PROJECTS.find((p) => p.id === projectId)
  if (!project) return null

  return {
    projectId,
    sponsors: [
      { tier: 'Champion', address: '0x742d...35Cc2', since: '2025-11-01', totalContributed: '400 USDC' },
      { tier: 'Sustainer', address: '0x8ba1...9f3E1', since: '2025-12-15', totalContributed: '75 USDC' },
      { tier: 'Sustainer', address: '0xdead...beef0', since: '2026-01-10', totalContributed: '50 USDC' },
      { tier: 'Supporter', address: '0xf00d...1234a', since: '2026-02-01', totalContributed: '15 USDC' },
      { tier: 'Supporter', address: '0xface...5678b', since: '2026-02-20', totalContributed: '5 USDC' },
    ],
    totalMonthlyFunding: `${project.fundingReceived} USDC`,
    fundingGoal: `${project.fundingGoal} USDC`,
    percentFunded: Math.round((project.fundingReceived / project.fundingGoal) * 100),
    generatedAt: new Date().toISOString(),
  }
}

// ── Routes ──────────────────────────────────────────────────────

const app = express()

// Public: health check
app.get('/api/status', (_req, res) => {
  res.json({
    service: 'Common Goods Project Registry',
    chain: CHAIN,
    chainId: chains[CHAIN].chainId,
    merchant: MERCHANT,
    projectCount: PROJECTS.length,
    totalFundingGoal: PROJECTS.reduce((sum, p) => sum + p.fundingGoal, 0),
    totalFundingReceived: PROJECTS.reduce((sum, p) => sum + p.fundingReceived, 0),
    status: 'ok',
  })
})

// Public: list all projects
app.get('/api/projects', (_req, res) => {
  res.json({
    projects: PROJECTS.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      maintainers: p.maintainers,
      license: p.license,
      monthlyDownloads: p.monthlyDownloads,
      dependents: p.dependents,
      fundingGoal: p.fundingGoal,
      fundingReceived: p.fundingReceived,
      percentFunded: Math.round((p.fundingReceived / p.fundingGoal) * 100),
      tiers: p.tiers.map((t) => ({
        name: t.name,
        amount: `${t.amount} USDC/month`,
        description: t.description,
      })),
    })),
    fundWith: 'AutoPay — subscribe to any tier to fund a project and unlock sponsor perks',
  })
})

// Public: single project details
app.get('/api/projects/:id', (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params.id)
  if (!project) return res.status(404).json({ error: 'Project not found' })

  res.json({
    ...project,
    percentFunded: Math.round((project.fundingReceived / project.fundingGoal) * 100),
    howToFund: {
      protocol: 'autopay',
      merchant: MERCHANT,
      chain: CHAIN,
      description: 'Subscribe to a funding tier to support this project and unlock sponsor perks',
    },
  })
})

// Sponsor-gated: sponsor list + funding breakdown
app.get('/api/projects/:id/sponsors', sponsorAuth, (req, res) => {
  const data = generateSponsorList(req.params.id)
  if (!data) return res.status(404).json({ error: 'Project not found' })

  res.json({
    ...data,
    subscriber: req.subscriber,
    policyId: req.policyId,
  })
})

// Sponsor-gated: build status feed
app.get('/api/projects/:id/builds', sponsorAuth, (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params.id)
  if (!project) return res.status(404).json({ error: 'Project not found' })

  res.json({
    ...generateBuildStatus(req.params.id),
    subscriber: req.subscriber,
    policyId: req.policyId,
  })
})

// Sponsor-gated: governance proposals
app.get('/api/projects/:id/governance', sponsorAuth, (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params.id)
  if (!project) return res.status(404).json({ error: 'Project not found' })

  res.json({
    ...generateGovernanceData(req.params.id),
    subscriber: req.subscriber,
    policyId: req.policyId,
  })
})

// Cache invalidation (used after cancellation)
app.delete('/api/subscriptions/:policyId', (req, res) => {
  sponsorAuth.invalidateCache(req.params.policyId)
  res.json({ invalidated: true })
})

// ── Start ───────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║       Common Goods Project Registry                   ║
  ║       Powered by AutoPay Protocol                     ║
  ╚═══════════════════════════════════════════════════════╝

  Chain:      ${CHAIN} (${chains[CHAIN].chainId})
  Merchant:   ${MERCHANT}
  Port:       ${PORT}
  Projects:   ${PROJECTS.length}

  Public Endpoints:
    GET    /api/status                        → Registry info
    GET    /api/projects                      → Project directory
    GET    /api/projects/:id                  → Project details

  Sponsor-Gated Endpoints (requires AutoPay subscription):
    GET    /api/projects/:id/sponsors         → Sponsor list + funding data
    GET    /api/projects/:id/builds           → CI/CD build status feed
    GET    /api/projects/:id/governance       → Governance proposals + voting

  Cache:
    DELETE /api/subscriptions/:id             → Invalidate subscription cache
  `)
})
