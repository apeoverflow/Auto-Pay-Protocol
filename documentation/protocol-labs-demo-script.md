# Protocol Labs Demo — Video Script

**AutoPay Protocol: Sustainable Funding for Common Goods**

---

## INTRO

*[Screen: AutoPay logo / landing page]*

Common goods projects have a funding problem. Open-source libraries, public datasets, decentralized infrastructure — the tools the entire ecosystem depends on — run on grants that come and go. A project gets funded for six months, hires contributors, then the grant runs out and the maintainers go back to their day jobs.

Recurring funding fixes this. But Stripe takes five to ten percent, settles in a week, and requires KYC. GitHub Sponsors works for individuals but not protocol-level infrastructure. Gitcoin runs periodic rounds, not continuous funding. And none of them support a new class of contributor — autonomous AI agents.

AutoPay is a non-custodial recurring payment protocol built on USDC. Two-point-five percent fees. Instant settlement. On-chain spending controls. And native support for both human and AI agent contributors.

Let me show you how it works — and how common goods projects can use it today.

---

## CREATING A FUNDING PLAN

*[Screen: Open autopayprotocol.com, connect merchant wallet, switch to Merchant mode]*

Any project can start accepting recurring funding in under a minute. There's no registration, no approval process. You connect your wallet — that's your merchant identity — and switch to Merchant mode.

*[Screen: Click "Create Plan", open the Plan Editor wizard]*

The Plan Editor is a three-step wizard. First, the plan details — the name, a description, and the features sponsors get at this tier. For a project like libp2p, you might create a "Sustainer" tier with priority issue triage, a private Discord channel, and a monthly impact report.

*[Screen: Fill in plan details, move to step 2]*

Second, your project info — name, logo, website, support email. This is what sponsors see on the checkout page.

*[Screen: Fill in merchant info, move to step 3]*

Third, billing. Set the amount — say twenty-five USDC — pick the interval — monthly — and the spending cap auto-calculates to twelve times the charge amount. That's three hundred USDC. The smart contract will never charge more than that.

*[Screen: Click Publish]*

When you publish, the plan metadata gets uploaded to IPFS via Storacha and pinned on Filecoin. The plan terms are immutable and verifiable — a sponsor can always check that the amount, interval, and description haven't changed since they subscribed.

*[Screen: Show the merchant dashboard overview — subscribers, revenue, reports]*

Once published, the dashboard tracks everything. Active subscribers, total revenue, charge history, monthly reports with CSV export. Receipts can be batch-uploaded to IPFS for immutable record-keeping. There's no payment infrastructure to build — the relayer handles recurring charges automatically, and the dashboard handles reporting.

---

## THE CHECKOUT EXPERIENCE

*[Screen: Plans page, click Share on the published plan]*

Now let's look at the sponsor experience. From the Plans page, click Share to open the Payment Link dialog.

*[Screen: Payment Link dialog — show field configuration]*

You can choose what information to collect from sponsors. For a common goods project, you might want an email for impact reports, and maybe a Discord handle for the private channel. Each field can be required or optional.

*[Screen: Click Generate Short Link, sign with wallet]*

Generate a short link. This is your checkout URL — share it on your website, in your docs, in your Discord, anywhere. You can also copy the full checkout URL if you prefer.

*[Screen: Open the checkout URL in a new tab]*

Let's walk through the checkout as a sponsor.

*[Screen: Checkout page — plan summary]*

First, the plan summary. The sponsor sees the plan name, amount, interval, features, and project info — all pulled from the IPFS metadata.

*[Screen: Connect wallet via RainbowKit]*

Connect a wallet. RainbowKit supports MetaMask, Rabby, WalletConnect, Coinbase Wallet — whatever the sponsor uses.

*[Screen: Show the LiFi bridge widget]*

If the sponsor's USDC is on Ethereum, Arbitrum, Polygon, or any of thirty-plus supported chains, the built-in LiFi bridge moves it to the settlement chain in one step. No need to leave the checkout page.

*[Screen: Approve USDC, then subscribe]*

Approve USDC to the PolicyManager contract — this is a one-time step. Then click Subscribe. The `createPolicy` function executes on-chain, and the first charge happens immediately in the same transaction. The project gets paid right now.

*[Screen: Success page]*

Done. The sponsor is subscribed. Renewals happen automatically — the relayer calls the contract's `charge` function every billing cycle. The sponsor doesn't need to do anything else. They can cancel at any time from their dashboard, effective immediately.

---

## GITHUB SPONSOR BADGE

*[Screen: Payment Link dialog — scroll to GitHub Sponsor Badge section]*

One more thing. Every published plan generates a "Sponsor with AutoPay" badge — a shields.io badge linked to your checkout page. Copy this markdown and drop it into your project's README.

*[Screen: Copy the badge markdown]*

We use this ourselves. If you look at the top of the AutoPay README on GitHub, there's a "Sponsor with AutoPay" badge. Click it, and you're taken directly to the checkout page.

*[Screen: Show the badge rendered in the AutoPay GitHub README]*

Now imagine every open-source project in the Protocol Labs ecosystem with this badge in their README. A developer who depends on libp2p clicks the badge and sets up a five-dollar-a-month recurring sponsorship in thirty seconds. A DAO treasury subscribes at the two-hundred-dollar-a-month Champion tier. An AI agent discovers the same plan and subscribes autonomously. One badge, three types of sponsors.

---

## FUNDING COMMON GOODS

*[Screen: Slide or graphic — "What Can Be Built on AutoPay"]*

Everything I just showed you is live today. The dashboard, the checkout, the badge, the relayer, the webhooks — it all works. Here's what can be built on top of this for common goods funding.

### Open-Source Project Funding

Any open-source project can create tiered funding plans. Supporter at five USDC a month — your name in SPONSORS.md. Sustainer at twenty-five — priority issue triage and a private Discord channel. Champion at a hundred — governance votes and roadmap input. Sponsors subscribe via the checkout link or GitHub badge. The project receives USDC directly to their wallet — no intermediary, no thirty-day hold, no chargebacks. Webhooks notify the project's backend to grant sponsor perks automatically.

### DAO Treasury Ecosystem Funding

DAOs and ecosystem funds sit on millions in stablecoins. AutoPay gives them a way to deploy that capital as sustainable, recurring funding. A DAO treasury subscribes to multiple projects — two hundred a month for libp2p, a hundred for IPFS UnixFS, fifty for drand — each with its own on-chain spending cap. No grant committee, no application process, no administrative overhead. Just recurring subscriptions with full on-chain audit trails. When a spending cap is reached, the subscription completes naturally. The contract enforces it — not a committee.

### Agent-Funded Infrastructure

This is where it gets interesting. AI agents increasingly depend on open-source infrastructure — libp2p for networking, IPFS for storage, drand for randomness. With AutoPay's Agent SDK and MCP server, an agent can discover a project's funding plans, evaluate its funding gap and ecosystem impact, and autonomously subscribe to fund it. The agent economy funding public goods. An agent that depends on libp2p can fund libp2p — no human grant application needed.

### Common Goods Registry

A natural extension is a registry that lists fundable projects with their AutoPay checkout links. Think of it as Gitcoin for subscriptions — but continuous, not round-based. Projects register, sponsors browse and subscribe, and all funding flows through the on-chain PolicyManager with full transparency. Sponsor perks — build status feeds, governance proposals, impact reports — can be gated behind subscriptions using the AutoPay middleware, verified on-chain via signed Bearer tokens.

---

## FILECOIN AND IPFS

*[Screen: Slide — Filecoin / IPFS integration points]*

A few things worth highlighting for Protocol Labs specifically.

Plan metadata is already stored on IPFS via Storacha and pinned on Filecoin. Every published plan has immutable, content-addressed terms.

Charge receipts can be batch-uploaded to IPFS — every payment gets an immutable record. Monthly revenue reports can be archived to Filecoin for verifiable accounting.

AutoPay is live on Flow EVM alongside Base, so projects in the Flow ecosystem can accept funding on their native chain.

And cross-chain funding means sponsors can pay from over thirty chains. USDC on Ethereum, Arbitrum, Polygon, or anywhere else bridges to the settlement chain through the built-in LiFi widget.

---

## CLOSING

*[Screen: AutoPay logo / summary slide]*

The common goods funding problem isn't a lack of money. It's a lack of sustainable, low-overhead payment rails.

AutoPay provides recurring funding instead of one-time grants. Two-point-five percent fees instead of five to ten percent with Stripe or fifteen to thirty percent in grants administration overhead. Non-custodial — funds stay in contributor wallets until charged. Instant settlement — USDC arrives immediately, not in two to seven business days. Agent-native — AI agents can fund the infrastructure they depend on. Transparent — every payment is on-chain and auditable. And no platform lock-in — the smart contract is on-chain, and the relayer is fully self-hostable.

The protocol is live on Base and Flow EVM. The contracts are deployed. The relayer is running. The dashboard is production-ready. We're looking for common goods projects and ecosystem funds to be early adopters.

---

## PRE-RECORDING CHECKLIST

- [ ] Merchant wallet connected to autopayprotocol.com (or staging.autopayprotocol.com for testnet)
- [ ] Switched to Merchant mode in the dashboard header
- [ ] Test plan created (or plan to create one live)
- [ ] Sponsor wallet funded with USDC + ETH for gas
- [ ] AutoPay GitHub README open in a browser tab (for badge demo)
- [ ] Browser tabs arranged: dashboard, checkout URL, GitHub README
- [ ] Screen recording software running at 1080p or higher
