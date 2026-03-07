# Protocol Labs Demo: Funding Common Goods with AutoPay

A demo script and example project showing how AutoPay can power sustainable, recurring funding for common goods projects (open-source tools, public datasets, IPFS infrastructure, research, etc.).

## The Problem

Common goods projects — open-source libraries, public datasets, decentralized infrastructure — struggle with sustainable funding. One-time grants create feast-or-famine cycles. Stripe and Patreon take 5-10% in fees. And none of them support autonomous agent contributions.

## The AutoPay Solution

AutoPay enables **non-custodial recurring USDC subscriptions** at 2.5% fees with:

- **Human sponsors** subscribing via wallet (monthly, quarterly, yearly)
- **AI agents** autonomously discovering and funding projects via HTTP 402
- **DAO treasuries** programmatically funding ecosystem dependencies
- **On-chain transparency** — every contribution is verifiable
- **Spending caps** — contributors control exactly how much they commit
- **Cross-chain funding** — USDC from 30+ chains via LiFi bridge

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  COMMON GOODS FUNDING                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │ Human Sponsor│   │  AI Agent    │   │ DAO Treasury │    │
│  │  (wallet)    │   │ (agent-sdk)  │   │  (multisig)  │    │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘    │
│         │                  │                   │             │
│         │    createPolicy()│                   │             │
│         v                  v                   v             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              PolicyManager (on-chain)                 │   │
│  │  - Enforces amounts, intervals, spending caps        │   │
│  │  - First charge immediate, then auto-recurring       │   │
│  │  - 2.5% protocol fee (vs 5-10% traditional)         │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             │                                │
│                             v                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Project Maintainer Wallet                │   │
│  │  - Receives USDC directly (non-custodial)            │   │
│  │  - Webhook notifications for each payment            │   │
│  │  - Dashboard for subscriber management               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Demo Components

### 1. `project-registry.js` — Common Goods Project Registry

A service that lists fundable common goods projects and gates sponsor perks behind AutoPay subscriptions. Returns HTTP 402 with funding plans when an agent or user requests access.

### 2. `sponsor-agent.js` — Autonomous Funding Agent

An AI agent that:
1. Discovers common goods projects via the registry
2. Evaluates funding tiers
3. Autonomously subscribes to fund a project
4. Receives sponsor perks (build status, priority support, governance tokens)
5. Manages its funding portfolio (cancel, renew, reallocate)

### 3. `dao-funder.js` — DAO Treasury Automated Funding

Demonstrates how a DAO treasury can programmatically fund multiple ecosystem dependencies with spending caps and quarterly reviews.

### 4. `demo.js` — Full Demo Runner

Orchestrates the registry, sponsor agent, and DAO funder for a live walkthrough.

## Quick Start

```bash
npm install

# Terminal 1: Start the project registry
MERCHANT_ADDRESS=0x... node project-registry.js

# Terminal 2: Run the sponsor agent
AGENT_PRIVATE_KEY=0x... CHAIN=base node sponsor-agent.js

# Or run the full demo
AGENT_PRIVATE_KEY=0x... MERCHANT_ADDRESS=0x... node demo.js
```

## Funding Tiers (Example)

| Tier | Amount | Interval | What Sponsors Get |
|------|--------|----------|-------------------|
| Supporter | 5 USDC | Monthly | Name in SPONSORS.md, build status webhook |
| Sustainer | 25 USDC | Monthly | Priority issue triage, private Discord channel |
| Champion | 100 USDC | Monthly | Governance vote, roadmap input, dedicated support |
| Annual Grant | 500 USDC | Yearly | All Champion perks + annual impact report |

## Why This Matters for Protocol Labs

1. **Filecoin Integration** — Merchant metadata and receipts stored on IPFS/Filecoin via Storacha
2. **Flow EVM Support** — AutoPay is live on Flow EVM alongside Base
3. **Agent Economy** — AI agents can autonomously fund the infrastructure they depend on
4. **Composable** — Any project can add a funding endpoint; any agent or wallet can subscribe
5. **Transparent** — All funding flows are on-chain and auditable
6. **Low Overhead** — 2.5% fee vs grants administration overhead of 15-30%
