# MCP Demo — Claude Code Subscribes to a Paid API

Claude Code uses AutoPay MCP tools to autonomously discover, subscribe to, and consume a paid crypto price API — all through natural conversation.

## What happens

1. You start a local price feed API (gated behind AutoPay subscription)
2. You open Claude Code in this directory (MCP server auto-configured via `.mcp.json`)
3. You ask Claude to "get me the latest crypto prices from http://localhost:4000/api/prices"
4. Claude calls `autopay_fetch`, gets a 402, reads the discovery body, auto-subscribes on-chain, and returns the data

No code written. No manual wallet interaction. The AI agent pays for API access autonomously.

## Prerequisites

- Node.js 20.6+
- Claude Code CLI installed
- A wallet with USDC + native gas token on your chosen chain
  - **Base** (mainnet): USDC + ETH
  - **Flow EVM**: USDC + FLOW
  - **Base Sepolia** (testnet): test USDC + Sepolia ETH

## Setup

### 1. Build the MCP package (if not already built)

```bash
cd ../../packages/mcp && npm install && npm run build
cd ../../packages/agent-sdk && npm install && npm run build
cd ../../packages/middleware && npm install && npm run build
```

### 2. Configure environment

```bash
cd examples/mcp-demo
npm install
cp .env.example .env
```

Edit `.env`:
```
AGENT_PRIVATE_KEY=0x...    # Funded wallet (relayer key works)
CHAIN=base                 # or flowEvm, baseSepolia
MERCHANT_ADDRESS=0x...     # Address that receives payments
```

### 3. Generate MCP config

```bash
npm run setup
```

This reads your `.env` and generates `.mcp.json` (gitignored — contains your private key). Claude Code auto-discovers it when launched from this directory.

## Run the demo

### Terminal 1 — Start the price feed service

```bash
npm run service
```

You should see:
```
  Crypto Price Feed (AutoPay-gated)
  ----------------------------------
  Chain:    base (8453)
  Merchant: 0x...
  Port:     4000

  Waiting for Claude Code to connect via MCP...
```

### Terminal 2 — Open Claude Code

```bash
cd examples/mcp-demo
claude
```

Then ask:

> "Get me the latest crypto prices from http://localhost:4000/api/prices"

Claude will:
1. Call `autopay_fetch` with that URL
2. Get a 402 response with AutoPay discovery body
3. Auto-subscribe (on-chain transaction — first charge immediate)
4. Retry the request with a signed Bearer token
5. Return the price data

### Follow-up prompts to try

- "What's my USDC balance?" — calls `autopay_balance`
- "Get the prices again" — reuses cached subscription, no new charge
- "Cancel my subscription" — calls `autopay_unsubscribe`
- "Try getting prices again" — gets 402 again (subscription cancelled)

## Architecture

```
┌─────────────────────┐     MCP tools      ┌─────────────────────┐
│    Claude Code      │◄──────────────────►│  AutoPay MCP Server  │
│  (conversation)     │                     │  (agent-sdk + viem)  │
└─────────────────────┘                     └──────────┬──────────┘
                                                       │
                                            on-chain   │  HTTP
                                            subscribe  │  fetch
                                                       │
                                            ┌──────────▼──────────┐
                                            │  Price Feed Service  │
                                            │  (Express + middleware)│
                                            │  localhost:4000      │
                                            └──────────┬──────────┘
                                                       │
                                              verifies │ policy
                                              on-chain │
                                                       ▼
                                            ┌─────────────────────┐
                                            │  PolicyManager.sol   │
                                            │  (Flow EVM / Base)   │
                                            └─────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `service.js` | Express API gated by `@autopayprotocol/middleware` |
| `setup.js` | Prints MCP config snippet with your env vars |
| `.mcp.json` | Claude Code MCP server config (uses env var references) |
| `CLAUDE.md` | Context for Claude Code when running in this directory |
| `.env.example` | Template for environment variables |

## Recording the demo

For a clean recording:

1. Start the service in a terminal (keep visible)
2. Open Claude Code in a split pane
3. Use a screen recorder (QuickTime, OBS, etc.)
4. Ask the prompt and let Claude work
5. The whole flow takes ~30 seconds

The key moment: Claude autonomously creating an on-chain subscription transaction to pay for API access.
