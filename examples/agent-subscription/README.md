# Agent Subscription Example

An autonomous AI agent subscribes to a data service using AutoPay recurring USDC payments.

## What This Demonstrates

The full agent subscription lifecycle from [AGENT_SUBSCRIPTIONS.md](../../docs/AGENT_SUBSCRIPTIONS.md):

1. **Discovery** — agent hits a protected endpoint, gets a 402 with subscription options
2. **Subscribe** — agent calls `agent.subscribe()` (auto-approves USDC if needed, first charge is immediate)
3. **Use** — agent accesses the API using `policyId` as a bearer token
4. **Cancel** — agent calls `agent.unsubscribe()` when done

## Components

| File | Description |
|------|-------------|
| `service.js` | Express data API that returns 402 when no subscription, verifies on-chain |
| `agent.js` | Autonomous agent that discovers, subscribes, uses, and cancels |
| `agent-wrapped.js` | Zero-boilerplate version using `wrapFetchWithSubscription` (402 handled transparently) |
| `agent-with-bridge.js` | Cross-chain bridging: bridges USDC from another chain before subscribing |
| `demo.js` | Runs both service + agent together |

## Prerequisites

- Node.js 20.6+ (uses `--env-file` flag)
- A wallet with USDC **and** native tokens for gas (ETH on Base/Base Sepolia, FLOW on Flow EVM)
- For testnet: get Base Sepolia ETH from a faucet and USDC from Circle's faucet

## Setup

```bash
# Build the SDK and middleware packages first
cd packages/agent-sdk && npm install && npm run build
cd ../middleware && npm install && npm run build

# Then set up the example
cd ../../examples/agent-subscription
npm install
cp .env.example .env
# Edit .env with your keys
```

## Run

### Option 1: Run both together

```bash
npm run demo
# or with inline env vars:
AGENT_PRIVATE_KEY=0x... MERCHANT_ADDRESS=0x... node demo.js
```

### Option 2: Run separately (two terminals)

Terminal 1 — start the service:
```bash
npm run service
# or: MERCHANT_ADDRESS=0x... CHAIN=baseSepolia node service.js
```

Terminal 2 — run the agent:
```bash
npm run agent
# or: AGENT_PRIVATE_KEY=0x... CHAIN=baseSepolia node agent.js
```

### Option 3: Zero-boilerplate agent

Same as Option 2, but use `agent-wrapped.js` instead. It uses `wrapFetchWithSubscription` to handle 402 responses automatically — no manual discovery/subscribe/token flow.

```bash
npm run agent:wrapped
```

### Option 4: Cross-chain bridge + subscribe

Bridges USDC from another chain (e.g. Ethereum, Arbitrum) to the destination chain before subscribing. Requires an RPC URL for the source chain.

```bash
SOURCE_CHAIN_ID=1 SOURCE_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/KEY \
  npm run agent:bridge
```

## Example Output

```
  ╔═══════════════════════════════════════╗
  ║   AutoPay Agent Subscription Demo     ║
  ╚═══════════════════════════════════════╝

  [agent] Wallet:  0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18
  [agent] Chain:   baseSepolia (84532)
  [agent] Service: http://localhost:4000
  [agent] USDC balance:   50.00
  [agent] Native balance: 0.1

  ── Step 1: Discover subscription requirements ──

  [agent] GET /api/prices → 402
  [agent] Service accepts: autopay
  [agent] Selected plan: "Basic" — 1 USDC every 86400s

  ── Step 2: Subscribe (first charge executes immediately) ──

  [agent] Subscription created!
  [agent]   policyId: 0xdef456...
  [agent]   explorer: https://sepolia.basescan.org/tx/0xabc123...

  ── Step 3: Use the service with subscription ──

  [agent] GET /api/prices → 200
  [agent]   BTC: $62104.33  ETH: $3412.87  SOL: $145.22

  ── Step 4: Cancel subscription ──

  [agent] Subscription cancelled
  [agent] POST-cancel GET /api/prices → 402 (expected 402)

  ── Demo complete ──
```

## How the 402 Discovery Works

When an agent hits `/api/prices` without a subscription, the service responds:

```json
{
  "error": "Subscription required",
  "accepts": ["autopay"],
  "autopay": {
    "type": "subscription",
    "merchant": "0x...",
    "plans": [
      { "name": "Basic", "amount": "1", "currency": "USDC", "interval": 86400 }
    ],
    "networks": [
      {
        "chainId": 84532,
        "policyManager": "0x...",
        "usdc": "0x..."
      }
    ]
  }
}
```

The agent parses this, picks a plan, and creates the on-chain subscription autonomously.

## Chains

| Chain | Env Value | Notes |
|-------|-----------|-------|
| Base Sepolia | `baseSepolia` | Testnet (default) |
| Flow EVM | `flowEvm` | Mainnet |
| Base | `base` | Mainnet |

Set via `CHAIN` env var. Default is `baseSepolia` for safe testing.
