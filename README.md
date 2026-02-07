<p align="center">
  <img src="frontend/public/logo.png" alt="AutoPay Protocol" width="400" />
</p>

**Non-custodial crypto subscription payments. 50% cheaper than Stripe.**

AutoPay is a decentralized subscription payment protocol built on USDC. Users maintain full custody of their funds while enabling merchants to collect recurring payments automatically. Cross-chain settlements via Circle CCTP bridge payments from any supported chain to Arc, where merchants receive funds.

## Features

- **Non-Custodial**: Funds stay in user wallets until charged. No intermediary custody.
- **Policy-Based**: Users set spending limits, intervals, and caps. Full control.
- **Multi-Chain**: Pay from Polygon, Arbitrum, or Arc. All settlements on Arc.
- **Simple UX**: Users only need USDC. No complex token management.
- **Passkey Auth**: Circle Modular Wallets enable passwordless, seedless onboarding.
- **Low Fees**: 2.5% protocol fee vs 5%+ for traditional processors.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User connects wallet (Circle Modular Wallet / EOA)          │
│  2. User approves USDC to PolicyManager                         │
│  3. User creates policy (merchant, amount, interval, cap)       │
│  4. Relayer calls charge() when payment is due                  │
│  5. USDC pulled from user → CCTP bridge → Merchant on Arc       │
│                                                                 │
│  ┌──────────┐     ┌───────────────┐     ┌──────────────┐        │
│  │  Payer   │────▶│ PolicyManager │────▶│   Merchant   │        │
│  │ (Polygon)│     │   (Polygon)   │     │    (Arc)     │        │
│  └──────────┘     └───────────────┘     └──────────────┘        │
│       │                   │                    ▲                │
│       │ approve()         │ charge()           │                │
│       │ createPolicy()    │ CCTP bridge        │ USDC arrives   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Solidity 0.8.20+, Foundry, OpenZeppelin |
| Frontend | React, Next.js, viem, wagmi, Tailwind CSS |
| Wallets | Circle Modular Wallets (passkey auth) |
| Bridging | Circle CCTP |
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

| Chain | USDC | PolicyManager |
|-------|------|---------------|
| Polygon Amoy | `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582` | TBD |
| Arbitrum Sepolia | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | TBD |
| Arc Testnet | `0x3600000000000000000000000000000000000000` | TBD |

## Environment Variables

### Frontend

```env
VITE_CLIENT_KEY=<circle-client-key>
VITE_CLIENT_URL=https://modular-sdk.circle.com/v1/rpc/w3s/buidl
VITE_POLICY_MANAGER_POLYGON=0x...
VITE_POLICY_MANAGER_ARBITRUM=0x...
VITE_POLICY_MANAGER_ARC=0x...
```

### Relayer

```env
DATABASE_URL=postgres://user:pass@host:5432/autopay
RELAYER_PRIVATE_KEY=0x...
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
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
- [x] Frontend with Circle Modular Wallets
- [x] Relayer implementation (indexer, executor, webhooks)
- [x] Merchant SDK (`@autopayprotocol/sdk`)
- [ ] Contract deployment to testnets
- [ ] End-to-end testing
- [ ] Mainnet launch

## Interested in Integrating?

If you're a merchant or project interested in accepting recurring crypto payments, reach out — we'd love to help you get set up.

**Email**: [autopayprotocol@proton.me](mailto:autopayprotocol@proton.me)

## Contributing

Contributions are welcome. Please open an issue first to discuss proposed changes.

## License

Apache 2.0 - See [LICENSE](./LICENSE) for details.
