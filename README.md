<p align="center">
  <img src="frontend/public/logo.png" alt="AutoPay Protocol" width="400" />
</p>

**Non-custodial crypto subscription payments. 50% cheaper than Stripe.**

AutoPay is a decentralized subscription payment protocol built on USDC. Users maintain full custody of their funds while enabling merchants to collect recurring payments automatically. All payments settle on Flow EVM, where merchants receive funds.

## Features

- **Non-Custodial**: Funds stay in user wallets until charged. No intermediary custody.
- **Policy-Based**: Users set spending limits, intervals, and caps. Full control.
- **Multi-Chain Funding**: Bridge USDC from any chain via LiFi. All settlements on Flow EVM.
- **Simple UX**: Users only need USDC. No complex token management.
- **Low Fees**: 2.5% protocol fee vs 5%+ for traditional processors.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User connects wallet (MetaMask, Rabby, etc.)                │
│  2. User bridges USDC to Flow EVM (if needed)                   │
│  3. User approves USDC to PolicyManager on Flow EVM             │
│  4. User creates policy (merchant, amount, interval, cap)       │
│  5. Relayer calls charge() when payment is due                  │
│                                                                 │
│  ┌────────────┐     ┌─────────┐     ┌───────────────┐           │
│  │  Payer     │────►│  Bridge │────►│ PolicyManager │           │
│  │(any chain) │     │  (LiFi) │     │  (Flow EVM)   │           │
│  └────────────┘     └─────────┘     └───────┬───────┘           │
│                                             │                   │
│                                             ▼                   │
│                                    ┌──────────────┐             │
│                                    │   Merchant   │             │
│                                    │  (Flow EVM)  │             │
│                                    └──────────────┘             │
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
| Settlement | Flow EVM Mainnet (Chain ID: 747) |

## Project Structure

```
Auto-Pay-Protocol/
├── contracts/           # Solidity smart contracts (Foundry)
│   ├── src/            # Contract source files
│   ├── test/           # Contract tests
│   ├── script/         # Deployment scripts
│   └── deployments/    # Deployment addresses per chain
├── frontend/           # React application
│   └── src/
│       ├── components/ # UI components
│       ├── contexts/   # Auth, wallet & chain state
│       └── hooks/      # Contract interaction hooks
├── relayer/            # Off-chain charge automation
│   └── src/
│       ├── indexer/    # Event indexing from chains
│       ├── executor/   # Charge execution logic
│       ├── webhooks/   # Merchant notifications
│       ├── api/        # Health & metadata endpoints
│       └── db/         # Postgres client & queries
├── packages/
│   └── sdk/            # Merchant SDK (@autopayprotocol/sdk)
├── examples/
│   └── merchant-checkout/  # Example merchant integration
└── docs/               # Architecture & integration docs
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

### Merchant Server (Example)

```bash
cd examples/merchant-checkout/merchant-server
npm install
node server.js      # http://localhost:3002
```

### Local End-to-End Test

Run all three in separate terminals, then visit `http://localhost:3002` to test the full checkout flow.

## Environment Variables

Each project has an `ENV.md` with the full list of variables, descriptions, and per-environment examples:

| Project | ENV Reference |
|---------|---------------|
| Contracts | [`contracts/ENV.md`](./contracts/ENV.md) |
| Frontend | [`frontend/ENV.md`](./frontend/ENV.md) |
| Relayer | [`relayer/ENV.md`](./relayer/ENV.md) |
| Merchant Server | [`examples/merchant-checkout/merchant-server/ENV.md`](./examples/merchant-checkout/merchant-server/ENV.md) |

## Smart Contract Interface

### PolicyManager.sol (Flow EVM)

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
| Flow EVM Mainnet | 747 | `0xF1815bd50389c46847f0Bda824eC8da914045D14` | `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345` |



## Roadmap

- [x] Product requirements & architecture
- [x] Smart contract design & implementation
- [x] Contract deployed to Flow EVM Mainnet
- [x] Frontend with RainbowKit wallet connection
- [x] LiFi cross-chain bridge integration
- [x] Relayer implementation (indexer, executor, webhooks)
- [x] Merchant SDK (`@autopayprotocol/sdk`)
- [x] End-to-end local testing
- [x] Production relayer deployment
- [ ] Merchant Dashboard
- [ ] Merchant IPFS Metadata / Assets
- [ ] Merchant Filecoin encrypted reciept and accounting record data 
- [ ] Merchant onboarding

## Interested in Integrating?

If you're a merchant or project interested in accepting recurring crypto payments, reach out — we'd love to help you get set up.

**Email**: [autopayprotocol@proton.me](mailto:autopayprotocol@proton.me)

## Contributing

Contributions are welcome. Please open an issue first to discuss proposed changes.

## License

Apache 2.0 - See [LICENSE](./LICENSE) for details.
