<p align="center">
  <img src="frontend/public/logo.png" alt="AutoPay Protocol" width="400" />
</p>

<p align="center">
  <a href="https://autopayprotocol.com/pay/sponsor-z_N_2q8a">
    <img src="https://img.shields.io/badge/Sponsor_with-AutoPay-0052FF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0wIDE4Yy00LjQyIDAtOC0zLjU4LTgtOHMzLjU4LTggOC04IDggMy41OCA4IDgtMy41OCA0LTggOHoiLz48cGF0aCBkPSJNMTAgOGw2IDQtNiA0VjgiLz48L3N2Zz4=" alt="Sponsor with AutoPay" />
  </a>
</p>

**Non-custodial crypto subscription payments for humans and AI agents. 50% cheaper than Stripe.**

AutoPay is a decentralized subscription payment protocol built on USDC. Users and autonomous agents maintain full custody of their funds while enabling merchants to collect recurring payments automatically. Payments settle on **Base** ([autopayprotocol.com](https://autopayprotocol.com)) and **Flow EVM** ([flow.autopayprotocol.com](https://flow.autopayprotocol.com)), with cross-chain funding from 30+ chains via LiFi.

## Features

- **Non-Custodial**: Funds stay in user wallets until charged. No intermediary custody.
- **Policy-Based**: Users set spending limits, intervals, and caps. Full control.
- **Multi-Chain Funding**: Bridge USDC from any chain via LiFi. Settlements on Base or Flow EVM.
- **Agent-Native**: AI agents can discover, subscribe to, and pay for services autonomously via the Agent SDK, MCP server, or HTTP 402 discovery.
- **Simple UX**: Users only need USDC. No complex token management.
- **Low Fees**: 2.5% protocol fee vs 5%+ for traditional processors.

## How It Works

### Human Users

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User connects wallet (MetaMask, Rabby, etc.)                │
│  2. User bridges USDC to Base or Flow EVM (if needed)           │
│  3. User approves USDC to PolicyManager                         │
│  4. User creates policy (merchant, amount, interval, cap)       │
│  5. Relayer calls charge() when payment is due                  │
│                                                                 │
│  ┌────────────┐     ┌─────────┐     ┌───────────────┐          │
│  │  Payer     │────>│  Bridge │────>│ PolicyManager │          │
│  │(any chain) │     │  (LiFi) │     │  (Base/Flow)  │          │
│  └────────────┘     └─────────┘     └───────┬───────┘          │
│                                              │                  │
│                                              v                  │
│                                     ┌──────────────┐           │
│                                     │   Merchant   │           │
│                                     └──────────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### AI Agents

```
┌─────────────────────────────────────────────────────────────────┐
│                        AGENT FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Agent requests a protected API endpoint                     │
│  2. Service returns HTTP 402 with plan discovery metadata       │
│  3. Agent subscribes on-chain (first charge is immediate)       │
│  4. Agent signs a Bearer token proving wallet ownership         │
│  5. Agent retries the request with the signed token             │
│  6. Service verifies the token and policy on-chain              │
│                                                                 │
│  ┌──────────────┐   402 + plans   ┌───────────────────┐        │
│  │  AI Agent    │<───────────────│  Protected Service │        │
│  │ (agent-sdk)  │───────────────>│   (middleware)     │        │
│  └──────┬───────┘  Bearer token   └───────────────────┘        │
│         │                                                       │
│         │ subscribe()                                           │
│         v                                                       │
│  ┌───────────────┐                                              │
│  │ PolicyManager │                                              │
│  │  (on-chain)   │                                              │
│  └───────────────┘                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Solidity 0.8.20+, Foundry, OpenZeppelin |
| Frontend | React, viem, wagmi, RainbowKit, Tailwind CSS |
| Cross-Chain | LiFi bridge widget |
| Relayer | Node.js, TypeScript, PostgreSQL |
| Agent SDK | TypeScript, viem, EIP-191 signed tokens |
| MCP Server | Model Context Protocol for Claude and other AI agents |
| Middleware | Express middleware for service providers |
| Settlement | Base (primary), Flow EVM |

## Project Structure

```
Auto-Pay-Protocol/
├── contracts/              # Solidity smart contracts (Foundry)
│   ├── src/               # Contract source files
│   ├── test/              # Contract tests
│   ├── script/            # Deployment scripts
│   └── deployments/       # Deployment addresses per chain
├── frontend/              # React application
│   └── src/
│       ├── components/    # UI components
│       ├── contexts/      # Auth, wallet & chain state
│       └── hooks/         # Contract interaction hooks
├── relayer/               # Off-chain charge automation
│   └── src/
│       ├── indexer/       # Event indexing from chains
│       ├── executor/      # Charge execution logic
│       ├── webhooks/      # Merchant notifications
│       ├── api/           # Health, metadata & logo endpoints
│       ├── lib/           # Storacha (IPFS), logo storage backends
│       └── db/            # Postgres client & queries
├── packages/
│   ├── agent-sdk/         # Agent subscription SDK (AutoPayAgent)
│   ├── mcp/               # MCP server for AI agents (Claude, etc.)
│   ├── middleware/         # Express middleware for service providers
│   └── sdk/               # Merchant SDK (@autopayprotocol/sdk)
├── examples/
│   ├── agent-subscription/  # End-to-end agent payment example
│   ├── merchant-checkout/   # Merchant integration example
│   └── webhook-receiver/    # Webhook handler example
└── docs/                  # Architecture & integration docs
```

## Agent Economy

AutoPay enables a new model where AI agents autonomously discover and pay for services. The protocol provides three packages for building agent-native payment flows:

### Agent SDK (`packages/agent-sdk`)

The core library for agents. Provides `AutoPayAgent` for on-chain subscription management and `wrapFetchWithSubscription()` for transparent HTTP 402 handling.

```typescript
import { AutoPayAgent, wrapFetchWithSubscription } from '@autopayprotocol/agent-sdk';

const agent = new AutoPayAgent({ privateKey, chain: 'base' });

// Option 1: Transparent auto-pay fetch wrapper
const fetch402 = wrapFetchWithSubscription(fetch, agent);
const res = await fetch402('https://data-service.com/api/prices');

// Option 2: Manual subscribe + token flow
const policyId = await agent.subscribe({ merchant, amount, interval, spendingCap });
const token = await agent.createBearerToken(policyId);
```

### MCP Server (`packages/mcp`)

Exposes AutoPay as an MCP tool server so Claude and other MCP-compatible agents can subscribe, fetch, and manage payments through tool calls.

Tools: `autopay_balance`, `autopay_subscribe`, `autopay_unsubscribe`, `autopay_get_policy`, `autopay_fetch`, `autopay_approve_usdc`, `autopay_bridge_usdc`

### Middleware (`packages/middleware`)

Express middleware for service providers to gate endpoints behind AutoPay subscriptions. Returns HTTP 402 with discovery metadata so agents know how to subscribe.

```typescript
import { requireSubscription } from '@autopayprotocol/middleware';

app.use('/api/data', requireSubscription({
  merchant: '0x...',
  chain: 'base',
  plans: [{ name: 'Pro', amount: '10', interval: 2592000 }],
}));
```

## Getting Started

### Smart Contracts

```bash
cd contracts
forge install
forge test          # Run all tests
make deploy         # Deploy to chain configured in .env
make sync           # Sync addresses + ABIs to frontend & relayer
```

### Frontend

```bash
cd frontend
npm install
npm run dev         # http://localhost:5173
```

### Relayer

```bash
cd relayer
npm install
npm run dev         # Starts indexer + executor + API on :3420
```

### Agent Example

```bash
cd examples/agent-subscription
npm install
node service.js     # Start protected data service on :3001
node agent.js       # Run autonomous agent that discovers, subscribes, and fetches
```

### Merchant Server (Example)

```bash
cd examples/merchant-checkout/merchant-server
npm install
node server.js      # http://localhost:3002
```

## Environment Variables

Each project has an `ENV.md` with the full list of variables, descriptions, and per-environment examples:

| Project | ENV Reference |
|---------|---------------|
| Contracts | [`contracts/ENV.md`](./contracts/ENV.md) |
| Frontend | [`frontend/ENV.md`](./frontend/ENV.md) |
| Relayer | [`relayer/ENV.md`](./relayer/ENV.md) |
| Merchant Server | [`examples/merchant-checkout/merchant-server/ENV.md`](./examples/merchant-checkout/merchant-server/ENV.md) |

## Smart Contract Interface

### PolicyManager.sol

```solidity
// Create a subscription policy (first charge happens immediately)
function createPolicy(
    address merchant,
    uint128 chargeAmount,
    uint32 interval,
    uint128 spendingCap,
    string calldata metadataUrl
) external returns (bytes32 policyId);

// Cancel a subscription
function revokePolicy(bytes32 policyId) external;

// Execute a recurring charge (called by relayer)
function charge(bytes32 policyId) external returns (bool success);

// Check if policy can be charged
function canCharge(bytes32 policyId) external view returns (bool, string memory);

// Cancel after 3 consecutive failures (callable by anyone)
function cancelFailedPolicy(bytes32 policyId) external;
```

## Contract Addresses

| Chain | Chain ID | USDC | PolicyManager |
|-------|----------|------|---------------|
| Base | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `0x037A24595E96B10d9FB2c7c2668FE5e7F354c86a` |
| Flow EVM Mainnet | 747 | `0xF1815bd50389c46847f0Bda824eC8da914045D14` | `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345` |
| Base Sepolia (testnet) | 84532 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345` |

## Roadmap

- [x] Product requirements and architecture
- [x] Smart contract design and implementation
- [x] Contract deployed to Flow EVM Mainnet
- [x] Contract deployed to Base Mainnet
- [x] Contract deployed to Base Sepolia (testnet)
- [x] Frontend with RainbowKit wallet connection
- [x] LiFi cross-chain bridge integration
- [x] Relayer implementation (indexer, executor, webhooks)
- [x] Merchant SDK (`@autopayprotocol/sdk`)
- [x] End-to-end local testing
- [x] Production relayer deployment
- [x] Merchant IPFS metadata (Storacha with IPFS + Filecoin pinning)
- [x] Logo upload and storage (Supabase Storage)
- [x] Merchant Dashboard
- [x] Merchant onboarding
- [x] Agent SDK for autonomous AI agent payments
- [x] MCP server for Claude and MCP-compatible agents
- [x] Express middleware for service providers (HTTP 402 discovery)
- [x] Agent subscription example (end-to-end)
- [ ] Merchant Filecoin encrypted receipt and accounting record data
- [ ] Agent SDK published to npm
- [ ] MCP server published to npm

## Interested in Integrating?

If you're a merchant or project interested in accepting recurring crypto payments (from humans or AI agents), reach out.

**Email**: [autopayprotocol@proton.me](mailto:autopayprotocol@proton.me)

## Contributing

Contributions are welcome. Please open an issue first to discuss proposed changes.

## License

Apache 2.0 - See [LICENSE](./LICENSE) for details.
