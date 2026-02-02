<p align="center">
  <img src="frontend/public/logo.png" alt="AutoPay Protocol" width="200" />
</p>

# AutoPay Protocol

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
| Relayer | Node.js, TypeScript, SQLite/Postgres |

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
    └── src/
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

# Configure
cp relayer.config.example.json relayer.config.json

# Run
RELAYER_PRIVATE_KEY=0x... npm run start
```

## Smart Contract Interface

### PolicyManager.sol

```solidity
// Create a subscription policy
function createPolicy(
    bytes32 merchantOnArc,
    uint128 chargeAmount,
    uint32 interval,
    uint128 spendingCap
) external returns (bytes32 policyId);

// Cancel a subscription
function revokePolicy(bytes32 policyId) external;

// Execute a charge (called by relayer)
function charge(bytes32 policyId) external returns (uint64 cctpNonce);

// Check if policy can be charged
function canCharge(bytes32 policyId) external view returns (bool, string memory);
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
RELAYER_PRIVATE_KEY=0x...
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
ARC_TESTNET_RPC=https://rpc-testnet.arc.network
WEBHOOK_URL=https://your-app.com/webhooks
```

## Documentation

- [Product Requirements (PRD)](./docs/PRD.md)
- [Smart Contract Specification](./docs/SMART_CONTRACTS.md)
- [Business Plan](./docs/BUSINESS_PLAN.md)
- [Frontend Architecture](./frontend/docs/README.md)

## Roadmap

- [x] Product requirements & architecture
- [x] Smart contract design
- [x] Frontend with Circle Modular Wallets
- [ ] PolicyManager contract implementation
- [ ] Contract deployment to testnets
- [ ] Relayer implementation
- [ ] End-to-end testing
- [ ] Mainnet launch

## Contributing

Contributions are welcome. Please open an issue first to discuss proposed changes.

## License

Apache 2.0 - See [LICENSE](./LICENSE) for details.
