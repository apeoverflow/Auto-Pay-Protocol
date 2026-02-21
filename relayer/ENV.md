# Relayer — Environment Variables

## Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase, Neon, or self-hosted) | `postgres://user:pass@host:5432/autopay` |
| `RELAYER_PRIVATE_KEY` | Wallet private key for submitting `charge()` transactions (needs native gas token) | `0xabc...` |

## Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `FLOW_EVM_RPC` | Flow EVM mainnet RPC URL override | `https://mainnet.evm.nodes.onflow.org` |
| `PORT` | HTTP server port for health/API endpoints | `3420` |
| `LOG_LEVEL` | Logging verbosity (`debug`, `info`, `warn`, `error`) | `info` |

## Notes

- **Chain configs are auto-generated** — `src/contracts.ts` is created by `make sync` in contracts/. It includes RPC URLs, contract addresses, and start blocks for each enabled chain.
- **RPC env vars follow a naming convention** — the generator converts camelCase chain keys to UPPER_SNAKE_CASE. `flowEvm` becomes `FLOW_EVM_RPC`.
- **The relayer wallet needs gas** — on Flow EVM, this means FLOW tokens to pay for `charge()` and `cancelFailedPolicy()` transactions.

## Environments

### Local Development

```env
DATABASE_URL=postgres://autopay:password@localhost:5432/autopay
RELAYER_PRIVATE_KEY=0x...
FLOW_EVM_RPC=https://mainnet.evm.nodes.onflow.org
PORT=3420
LOG_LEVEL=debug
```

### Production

```env
DATABASE_URL=postgres://user:pass@your-db-host:5432/autopay
RELAYER_PRIVATE_KEY=0x...
FLOW_EVM_RPC=https://mainnet.evm.nodes.onflow.org
PORT=3420
LOG_LEVEL=info
```
