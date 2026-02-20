# AutoPay Protocol - Smart Contracts

Non-custodial subscription payment contracts for recurring USDC payments.

## Directory Structure

```
contracts/
├── src/
│   └── PolicyManager.sol        # Subscription policy management
├── script/
│   └── Deploy.s.sol             # Forge deployment script
├── scripts/
│   ├── deploy.sh                # Deploy + save deployment info
│   ├── verify.sh                # Verify on Blockscout
│   ├── verify-check.sh          # Check verification status
│   ├── sync.sh                  # Sync ABIs/addresses to frontend
│   └── generate-contracts-ts.js # Generate TypeScript config
├── test/
│   ├── PolicyManager.t.sol      # Contract tests
│   └── mocks/
│       └── MockUSDC.sol         # Mock USDC for testing
├── deployments/                 # Deployment records (JSON per chain)
├── abis/                        # Generated ABI files
├── Makefile                     # All commands
└── .env.example                 # Environment template
```

## Contracts

### PolicyManager.sol

Handles non-custodial recurring USDC subscriptions.

**Key behavior:**
- `createPolicy()` executes the **first charge immediately** within the same transaction
- `charge()` is for subsequent recurring charges only (called by relayer)
- 2.5% protocol fee on each charge

**Functions:**
- `createPolicy(merchant, chargeAmount, interval, spendingCap, metadataUrl)` - Create subscription + first charge
- `revokePolicy(policyId)` - Cancel subscription (payer only)
- `charge(policyId)` - Execute recurring charge (anyone can call when due)
- `canCharge(policyId)` - Check if charge is possible
- `batchCharge(policyIds)` - Charge multiple policies

## Quick Start

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
forge install

# Copy environment template
cp .env.example .env
# Edit .env with your values

# Run tests
make test

# Deploy
make deploy

# Verify contract
make verify

# Sync to frontend
make sync
```

## Makefile Commands

```bash
make help              # Show all commands

# Development
make test              # Run all tests with verbosity
make clean             # Clean build artifacts

# Deployment
make deploy            # Deploy PolicyManager
make verify            # Submit verification to Blockscout
make verify-check      # Check if verification succeeded

# Sync
make generate-abis     # Generate ABI JSON files
make sync              # Sync ABIs and addresses to frontend
make reset-indexer-db  # Reset indexer DB after new deployment

# Utils
make wallet            # Show deployer address from PRIVATE_KEY
```

### Reset Indexer Database

After deploying a new contract, reset the indexer database to clear old data:

```bash
# Requires psql and DATABASE_URL (defaults to local docker-compose)
make reset-indexer-db
```

This will:
- Clear all policies, charges, and webhooks
- Reset indexer state to start from the new deploy block
- Preserve merchant webhook configurations

## Environment Variables

Create `.env` from `.env.example`:

```bash
# Required for deployment
PRIVATE_KEY=0x...              # Deployer wallet
FEE_RECIPIENT=0x...            # Address to collect protocol fees
RPC_URL=https://mainnet.evm.nodes.onflow.org
USDC_ADDRESS=0xF1815bd50389c46847f0Bda824eC8da914045D14
```

## Testing

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test
forge test --match-test testCreatePolicy

# Gas report
forge test --gas-report
```

## Contract Constants

```solidity
PROTOCOL_FEE_BPS = 250      // 2.5%
MIN_INTERVAL = 1 minutes    // For demo/testing
MAX_INTERVAL = 365 days
```

## Events

| Event | Description |
|-------|-------------|
| `PolicyCreated` | New subscription created (includes first charge) |
| `PolicyRevoked` | Subscription cancelled |
| `ChargeSucceeded` | Payment processed successfully |
| `ChargeFailed` | Payment failed (batch charge only) |
| `FeesWithdrawn` | Protocol fees withdrawn |

## License

Apache-2.0
