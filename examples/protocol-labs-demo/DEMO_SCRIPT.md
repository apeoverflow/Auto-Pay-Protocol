# Protocol Labs Demo Script

**AutoPay Protocol — Sustainable Funding for Common Goods**

*Presenter guide for the Protocol Labs demo. Run `node demo.js` alongside this script.*

---

## Opening (2 min)

> "Common goods projects — the open-source libraries, decentralized infrastructure, and public datasets that the entire ecosystem depends on — have a funding problem. Grants are lumpy: feast-or-famine cycles that don't match the steady cost of maintaining critical software. Stripe and Patreon take 5-10% in fees. And none of them support a new class of contributor: autonomous AI agents.
>
> AutoPay solves this with non-custodial, recurring USDC subscriptions at 2.5% fees. Today I'll show you three things:
>
> 1. How a project publishes funding tiers that both humans and agents can discover
> 2. How an AI agent autonomously finds and funds the infrastructure it depends on
> 3. How a DAO treasury programmatically funds an entire ecosystem of dependencies"

---

## Part 1: The Project Registry (3 min)

### What to show

Start the registry: `MERCHANT_ADDRESS=0x... node project-registry.js`

**Public endpoints (no subscription needed):**

```bash
# Project directory — anyone can browse
curl http://localhost:4100/api/projects | jq

# Single project with funding details
curl http://localhost:4100/api/projects/libp2p-js | jq
```

### Talking points

- "This registry lists common goods projects with tiered funding plans — Supporter at $5/month, Sustainer at $25, Champion at $100."
- "The data is public. Anyone can browse. But sponsor perks — build status, governance votes, priority support — require an active AutoPay subscription."
- "Watch what happens when we hit a gated endpoint without a subscription:"

```bash
# Sponsor-gated endpoint — returns 402 with funding plans
curl http://localhost:4100/api/projects/libp2p-js/sponsors | jq
```

- "HTTP 402 — Payment Required. The response body tells agents exactly how to subscribe: the merchant address, available plans, supported chains, and contract addresses. This is the same HTTP 402 discovery mechanism that the agent SDK uses."

### Key message

> "Any project can publish a funding endpoint. Any wallet — human or agent — can subscribe. The protocol handles the rest: first charge is immediate, renewals are automatic, and the project gets webhooks for every payment."

---

## Part 2: The Sponsor Agent (5 min)

### What to show

Run in a second terminal: `AGENT_PRIVATE_KEY=0x... node sponsor-agent.js`

### Step-by-step narration

**Step 1 — Discovery:**
> "The agent queries the registry and finds 4 fundable projects: libp2p, IPFS UnixFS, Filecoin storage tools, and drand."

**Step 2 — Evaluation:**
> "It scores each project on three criteria: funding gap (how underfunded it is), ecosystem impact (download volume), and dependency count (how many projects rely on it). This is a simple heuristic — in production, an agent could use more sophisticated analysis."

**Step 3 — Tier selection:**
> "It picks the highest tier it can afford. The agent checks its USDC balance and selects accordingly."

**Step 4 — HTTP 402:**
> "It hits the sponsor-gated endpoint, gets back a 402 with AutoPay discovery metadata. This is the same flow that `wrapFetchWithSubscription` handles transparently."

**Step 5 — Subscribe:**
> "One on-chain transaction: approve USDC + create policy. The first payment happens immediately in the same transaction. The spending cap is set to 12 months — the agent won't spend more than that without human review."

**Step 6 — Access perks:**
> "Now the agent creates a signed Bearer token — an EIP-191 signature proving it owns the wallet that subscribed — and accesses sponsor perks: the sponsor list, build status, and governance proposals."

**Step 7 — Lifecycle:**
> "The agent cancels to demonstrate the full lifecycle. In production, it would maintain these subscriptions indefinitely. The relayer handles renewals automatically — the agent doesn't need to do anything after subscribing."

### Key message

> "This is the agent economy applied to public goods. An AI agent that depends on libp2p can autonomously fund libp2p. No human needs to file a grant application. No foundation needs to approve a disbursement. The agent just subscribes."

---

## Part 3: DAO Treasury Funder (5 min)

### What to show

The demo runner handles this automatically, or run standalone:
`AGENT_PRIVATE_KEY=0x... node dao-funder.js`

### Step-by-step narration

**Funding policy:**
> "The DAO has a $500/month ecosystem fund. It allocates budget by category: 35% to infrastructure, 25% to data layer, 25% to storage, 15% to cryptography. Each project is capped at $200/month, and spending caps are set to 3 months for quarterly review."

**Budget allocation:**
> "The funder evaluates each project and computes an allocation based on category weight and funding gap. Underfunded infrastructure projects get higher allocations. This mirrors how the Filecoin Foundation or Protocol Labs might allocate across their dependency graph."

**Multi-project subscription:**
> "It subscribes to multiple projects in sequence. Each subscription is a separate on-chain policy with its own spending cap. The DAO can cancel any individual subscription without affecting the others."

**Portfolio verification:**
> "It verifies sponsor access across all funded projects — every subscription works, every perk is accessible."

### Key message

> "DAO treasuries sit on millions in stablecoins. AutoPay gives them a way to deploy that capital as sustainable, recurring funding with on-chain spending controls. Every contribution has a spending cap enforced by the smart contract. Every payment is on-chain and auditable. And the 2.5% fee is a fraction of what grant administration typically costs."

---

## Technical Deep Dive (3 min — if audience is technical)

### Smart Contract

```
PolicyManager.createPolicy(merchant, chargeAmount, interval, spendingCap, metadataUrl)
  → First charge happens in the same transaction
  → Returns a policyId (bytes32 hash)
  → Relayer calls charge(policyId) on schedule
  → After 3 consecutive failures, anyone can call cancelFailedPolicy()
```

### On-chain protections
- **Spending caps**: `totalSpent + chargeAmount <= spendingCap` checked on every charge
- **Fixed amounts**: Merchants cannot change the charge amount after creation
- **Interval enforcement**: `block.timestamp >= lastCharged + interval`
- **Auto-cancel**: 3 consecutive failures → policy is cancellable by anyone

### Agent SDK

```javascript
const agent = new AutoPayAgent({ privateKey, chain: 'base' })

// Subscribe — auto-approves USDC if needed
const { policyId } = await agent.subscribe({
  merchant: '0x...',
  amount: 25,
  interval: 2592000, // monthly
  spendingCap: 300,  // 12 months
})

// Create signed Bearer token for API access
const token = await agent.createBearerToken(policyId)
```

### Service-side (middleware)

```javascript
import { requireSubscription } from '@autopayprotocol/middleware'

app.get('/api/sponsors', requireSubscription({
  merchant: '0x...',
  chain: 'base',
  plans: [{ name: 'Sustainer', amount: '25', interval: 2592000 }],
}), handler)
```

### MCP integration

> "For LLM-based agents like Claude, we have an MCP server with 8 tools. The agent doesn't need any code — it just calls `autopay_fetch` and the MCP server handles 402 discovery, subscription, and token management."

---

## Filecoin / IPFS Integration Points (2 min)

1. **Metadata on IPFS/Filecoin** — Plan metadata (name, description, features, logo) is uploaded to IPFS via Storacha with Filecoin pinning. Every subscriber can verify the plan terms haven't changed.

2. **Receipts on IPFS** — Merchants can batch-upload charge receipts to IPFS for immutable record-keeping. Each receipt links to the on-chain transaction.

3. **Reports archival** — Monthly revenue reports can be archived to Filecoin for verifiable accounting.

4. **Flow EVM** — AutoPay is live on Flow EVM alongside Base. Projects in the Flow ecosystem can accept funding on their native chain.

---

## Closing (1 min)

> "The common goods funding problem isn't a lack of money — it's a lack of sustainable, low-overhead payment rails. AutoPay provides:
>
> - **Recurring funding** instead of one-time grants
> - **2.5% fees** instead of 15-30% grants administration
> - **Non-custodial** — funds stay in contributor wallets until charged
> - **Agent-native** — AI agents can fund the infrastructure they depend on
> - **Transparent** — every payment is on-chain and auditable
> - **Composable** — any project adds a funding endpoint, any wallet subscribes
>
> The protocol is live on Base and Flow EVM. The smart contracts are deployed, the relayer is running, the Agent SDK and MCP server are built. We're looking for common goods projects and ecosystem funds to be early adopters."

---

## Environment Setup (for running the demo)

```bash
cd examples/protocol-labs-demo
npm install

# Set environment variables
export AGENT_PRIVATE_KEY=0x...     # Wallet with USDC + ETH on Base Sepolia
export MERCHANT_ADDRESS=0x...      # Merchant wallet to receive funding
export CHAIN=baseSepolia           # Use testnet for demo

# Run the full demo
node demo.js

# Or run components individually
node project-registry.js           # Terminal 1
node sponsor-agent.js              # Terminal 2
node dao-funder.js                 # Terminal 3
```

### Testnet setup
- Get Base Sepolia ETH from the [Base Sepolia faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
- Get testnet USDC from the [Circle USDC faucet](https://faucet.circle.com/)
- PolicyManager on Base Sepolia: `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345`
