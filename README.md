<p align="center">
  <img src="frontend/public/logo.png" alt="AutoPay Protocol" width="400" />
</p>

**Non-custodial crypto subscription payments. 50% cheaper than Stripe.**

AutoPay is a decentralized subscription payment protocol built on USDC. Users maintain full custody of their funds while enabling merchants to collect recurring payments automatically. Users fund their wallet from 12+ chains via Circle Gateway, and all payments settle on Arc, where merchants receive funds.

## Features

- **Non-Custodial**: Funds stay in user wallets until charged. No intermediary custody.
- **Policy-Based**: Users set spending limits, intervals, and caps. Full control.
- **Multi-Chain**: Fund from 12+ chains via Circle Gateway. All settlements on Arc.
- **Simple UX**: Users only need USDC. No complex token management.
- **Passkey Auth**: Circle Modular Wallets enable passwordless, seedless onboarding.
- **Low Fees**: 2.5% protocol fee vs 5%+ for traditional processors.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User connects wallet (Circle Modular Wallet)                │
│  2. User funds wallet from any chain via Circle Gateway         │
│  3. User approves USDC to PolicyManager on Arc                  │
│  4. User creates policy (merchant, amount, interval, cap)       │
│  5. Relayer calls charge() when payment is due                  │
│                                                                 │
│  ┌──────────┐     ┌─────────┐     ┌───────────────┐            │
│  │  Payer   │────►│ Gateway │────►│ PolicyManager │            │
│  │(any chain)│     │         │     │    (Arc)      │            │
│  └──────────┘     └─────────┘     └───────┬───────┘            │
│                                           │                     │
│                                           ▼                     │
│                                    ┌──────────────┐             │
│                                    │   Merchant   │             │
│                                    │    (Arc)     │             │
│                                    └──────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Solidity 0.8.20+, Foundry, OpenZeppelin |
| Frontend | React, Next.js, viem, wagmi, Tailwind CSS |
| Wallets | Circle Modular Wallets (passkey auth) |
| Cross-Chain | Circle Gateway (12+ chains) |
| Relayer | Node.js, TypeScript, PostgreSQL |

## Project Structure

```
Auto-Pay-Protocol/
├── contracts/           # Solidity smart contracts (Foundry)
│   ├── src/            # Contract source files
│   ├── test/           # Contract tests
│   └── script/         # Deployment scripts
├── frontend/           # React/Next.js application
│   └── src/
│       ├── components/ # UI components
│       ├── contexts/   # Auth & wallet state
│       └── hooks/      # Contract interaction hooks
├── relayer/            # Off-chain charge automation
│   └── src/
│       ├── indexer/    # Event indexing from chains
│       ├── executor/   # Charge execution logic
│       ├── webhooks/   # Merchant notifications
│       ├── api/        # Health check endpoint
│       └── db/         # Postgres client & queries
├── packages/
│   └── sdk/            # Merchant SDK (@autopayprotocol/sdk)
├── examples/
│   ├── merchant-checkout/  # Example merchant checkout integration
│   └── webhook-receiver/   # Example webhook handler
└── docs/               # Architecture & integration docs
```

## Getting Started

### Smart Contracts

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Navigate to contracts
cd contracts

# Install dependencies
forge install

# Run tests
forge test

# Deploy to testnet
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_KEY \
  --broadcast
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your keys

# Run development server
npm run dev
```

### Relayer

```bash
cd relayer

# Install dependencies
npm install

# Run with managed postgres (supabase, neon, etc.)
DATABASE_URL=postgres://... RELAYER_PRIVATE_KEY=0x... npm run start

# Or use docker compose (includes postgres)
docker compose up -d
```

## Smart Contract Interface

### ArcPolicyManager.sol (Arc Testnet)

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

## Testnet Addresses

| Chain | USDC | ArcPolicyManager |
|-------|------|------------------|
| Arc Testnet | `0x3600000000000000000000000000000000000000` | `0x0a681aC070ef81afb1c888D3370246633aE46A27` |

Users fund their Arc wallet from 12+ chains via [Circle Gateway](https://developers.circle.com/gateway). All subscriptions and charges happen natively on Arc.

## Environment Variables

### Frontend

```env
VITE_CLIENT_KEY=<circle-client-key>
VITE_CLIENT_URL=https://modular-sdk.circle.com/v1/rpc/w3s/buidl
VITE_POLICY_MANAGER_ARC=0x0a681aC070ef81afb1c888D3370246633aE46A27
```

### Relayer

```env
DATABASE_URL=postgres://user:pass@host:5432/autopay
RELAYER_PRIVATE_KEY=0x...
ARC_TESTNET_RPC=https://rpc-testnet.arc.network
```

## Documentation

- [Product Requirements (PRD)](./docs/PRD.md)
- [Smart Contract Specification](./docs/SMART_CONTRACTS.md)
- [Relayer Architecture](./docs/RELAYER.md)
- [Merchant Integration Guide](./docs/MERCHANT_INTEGRATION.md)
- [SDK Documentation](./docs/SDK.md)
- [Business Plan](./docs/BUSINESS_PLAN.md)

## Roadmap

- [x] Product requirements & architecture
- [x] Smart contract design
- [x] Smart contract implementation (ArcPolicyManager)
- [x] Contract deployed to Arc Testnet
- [x] Frontend with Circle Modular Wallets
- [x] Circle Gateway cross-chain funding (12+ chains)
- [x] Relayer implementation (indexer, executor, webhooks)
- [x] Merchant SDK (`@autopayprotocol/sdk`)
- [x] End-to-end testing
- [ ] Mainnet launch

## Interested in Integrating?

If you're a merchant or project interested in accepting recurring crypto payments, reach out — we'd love to help you get set up.

**Email**: [autopayprotocol@proton.me](mailto:autopayprotocol@proton.me)

## Contributing

Contributions are welcome. Please open an issue first to discuss proposed changes.

## License

Apache 2.0 - See [LICENSE](./LICENSE) for details.
