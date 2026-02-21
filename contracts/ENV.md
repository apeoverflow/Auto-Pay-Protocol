# Contracts — Environment Variables

## Required

| Variable | Description | Example |
|----------|-------------|---------|
| `PRIVATE_KEY` | Deployer wallet private key (needs native gas token on target chain) | `0xabc...` |
| `FEE_RECIPIENT` | Address that receives 2.5% protocol fees on `withdrawFees()` | `0x2B8b...` |
| `RPC_URL` | RPC endpoint for the target chain | `https://mainnet.evm.nodes.onflow.org` |
| `USDC_ADDRESS` | USDC contract address on the target chain | `0xF1815bd50389c46847f0Bda824eC8da914045D14` |
| `CHAIN_NAME` | Chain identifier used in deployment JSON and sync scripts | `flowEvm` |

## Optional

| Variable | Description | Example |
|----------|-------------|---------|
| `EXPLORER_URL` | Block explorer URL (for verification links) | `https://evm.flowscan.io` |
| `VERIFIER_URL` | Block explorer API URL (for contract verification) | `https://evm.flowscan.io/api/` |
| `DATABASE_URL` | Relayer database URL (used by `make reset-indexer-db` only) | `postgres://user:pass@host:5432/autopay` |

## Environments

### Flow EVM Mainnet (Production)

```env
PRIVATE_KEY=0x...
FEE_RECIPIENT=0x...
RPC_URL=https://mainnet.evm.nodes.onflow.org
USDC_ADDRESS=0xF1815bd50389c46847f0Bda824eC8da914045D14
CHAIN_NAME=flowEvm
EXPLORER_URL=https://evm.flowscan.io
VERIFIER_URL=https://evm.flowscan.io/api/
```

### Flow EVM Testnet

```env
PRIVATE_KEY=0x...
FEE_RECIPIENT=0x...
RPC_URL=https://testnet.evm.nodes.onflow.org
USDC_ADDRESS=<testnet-usdc-address>
CHAIN_NAME=flowEvmTestnet
EXPLORER_URL=https://evm-testnet.flowscan.io
VERIFIER_URL=https://evm-testnet.flowscan.io/api/
```

## Deployment Output

Running `make deploy` creates `deployments/<chainId>.json` with the contract address, deploy block, and chain metadata. Running `make sync` propagates this to the frontend and relayer.
