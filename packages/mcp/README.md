# @autopayprotocol/mcp

[Model Context Protocol](https://modelcontextprotocol.io) server that gives AI agents (Claude, Cursor, Windsurf) the ability to manage USDC subscriptions on [AutoPay Protocol](https://autopayprotocol.com). Zero-code integration — just add to your MCP config.

## Install

```bash
npm install -g @autopayprotocol/mcp
```

## Setup

Add to your MCP configuration file:

### Claude Code (`~/.claude/settings.json`)

```json
{
  "mcpServers": {
    "autopay": {
      "command": "npx",
      "args": ["-y", "@autopayprotocol/mcp"],
      "env": {
        "AUTOPAY_PRIVATE_KEY": "0x...",
        "AUTOPAY_CHAIN": "base"
      }
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "autopay": {
      "command": "npx",
      "args": ["-y", "@autopayprotocol/mcp"],
      "env": {
        "AUTOPAY_PRIVATE_KEY": "0x...",
        "AUTOPAY_CHAIN": "base"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTOPAY_PRIVATE_KEY` | Yes | Agent wallet private key (0x...) |
| `AUTOPAY_CHAIN` | No | Chain to use: `base` (default), `flowEvm`, `baseSepolia` |
| `AUTOPAY_RPC_URL` | No | Override the default public RPC URL |

Aliases: `AGENT_PRIVATE_KEY` (for `AUTOPAY_PRIVATE_KEY`), `CHAIN` (for `AUTOPAY_CHAIN`).

## Tools

| Tool | Description |
|------|-------------|
| `autopay_balance` | Check wallet USDC and gas token balance |
| `autopay_subscribe` | Create an on-chain subscription (first payment immediate) |
| `autopay_unsubscribe` | Cancel a subscription by revoking the policy |
| `autopay_get_policy` | Read on-chain policy details (status, amount, cap, etc.) |
| `autopay_fetch` | Fetch a URL with auto-subscription on HTTP 402 |
| `autopay_approve_usdc` | Pre-approve USDC spending to PolicyManager |
| `autopay_bridge_usdc` | Bridge USDC from another chain via LiFi |
| `autopay_swap_native_to_usdc` | Swap native tokens (ETH, FLOW) to USDC |

### Tool Details

#### `autopay_subscribe`

| Input | Type | Description |
|-------|------|-------------|
| `merchant` | `string` | Merchant EVM address |
| `amount` | `number` | USDC per billing cycle |
| `interval` | `string \| number` | Preset (`monthly`, `weekly`, etc.) or seconds |
| `spendingCap?` | `number` | Max total spend. Default: `amount * 30` |
| `metadataUrl?` | `string` | Optional plan metadata URL |

#### `autopay_fetch`

| Input | Type | Description |
|-------|------|-------------|
| `url` | `string` | URL to fetch |
| `method?` | `string` | HTTP method (GET, POST, etc.) |
| `headers?` | `object` | Request headers |
| `body?` | `string` | Request body |

If the server returns HTTP 402 with an AutoPay discovery body, the tool automatically subscribes and retries with authentication.

#### `autopay_bridge_usdc`

| Input | Type | Description |
|-------|------|-------------|
| `fromChainId` | `number` | Source chain ID |
| `amount` | `number` | USDC amount to bridge |
| `sourceRpcUrl` | `string` | RPC URL for the source chain |
| `slippage?` | `number` | Slippage tolerance in %. Default: 0.5 |

Supported source chains: Ethereum (1), Optimism (10), Polygon (137), Arbitrum (42161), Avalanche (43114), BSC (56), Base (8453), Flow EVM (747).

## How It Works

1. Agent starts the MCP server with a funded wallet
2. When the agent encounters a paid API, it uses `autopay_fetch` or `autopay_subscribe`
3. The server creates an on-chain subscription policy (first charge immediate)
4. Subsequent requests reuse cached subscriptions automatically
5. The agent can check status with `autopay_get_policy` and cancel with `autopay_unsubscribe`

## Links

- [Full Documentation](https://autopayprotocol.com/docs)
- [Agent SDK](https://www.npmjs.com/package/@autopayprotocol/agent-sdk)
- [Middleware](https://www.npmjs.com/package/@autopayprotocol/middleware)
