# MCP Server Reference

Complete reference for `@autopayprotocol/mcp` — a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes AutoPay subscription operations as tools for AI agents running in Claude Code, Cursor, Windsurf, and other MCP-compatible environments.

> **Important: Use a burner wallet with limited funds for testing only.** Putting private keys into LLMs is not safe. MCP config files may be stored in plaintext, and LLM providers may log tool inputs. This integration is in active development — do not use wallets that hold significant funds.

## Installation

```bash
npm install -g @autopayprotocol/mcp
```

Or use directly with `npx` (no install needed):

```bash
npx @autopayprotocol/mcp
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTOPAY_PRIVATE_KEY` | Yes | — | Agent wallet private key (`0x...`) |
| `AUTOPAY_CHAIN` | No | `base` | Chain: `base`, `flowEvm`, or `baseSepolia` |
| `AUTOPAY_RPC_URL` | No | Public RPC | Override the default RPC URL |

**Aliases:** `AGENT_PRIVATE_KEY` works as an alias for `AUTOPAY_PRIVATE_KEY`, and `CHAIN` works as an alias for `AUTOPAY_CHAIN`.

## Setup

The MCP server communicates over stdio. Add it to your AI tool's MCP configuration.

### Claude Code

Add to `~/.claude/settings.json` (global) or `.claude/settings.json` (project):

```json
{
  "mcpServers": {
    "autopay": {
      "command": "npx",
      "args": ["-y", "@autopayprotocol/mcp"],
      "env": {
        "AUTOPAY_PRIVATE_KEY": "0xYourAgentPrivateKey",
        "AUTOPAY_CHAIN": "base"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "autopay": {
      "command": "npx",
      "args": ["-y", "@autopayprotocol/mcp"],
      "env": {
        "AUTOPAY_PRIVATE_KEY": "0xYourAgentPrivateKey",
        "AUTOPAY_CHAIN": "base"
      }
    }
  }
}
```

### Windsurf

Add to `~/.windsurf/mcp.json`:

```json
{
  "mcpServers": {
    "autopay": {
      "command": "npx",
      "args": ["-y", "@autopayprotocol/mcp"],
      "env": {
        "AUTOPAY_PRIVATE_KEY": "0xYourAgentPrivateKey",
        "AUTOPAY_CHAIN": "base"
      }
    }
  }
}
```

## Tools

The server registers 8 tools. All return JSON-formatted text content.

### autopay_balance

Check the agent wallet's USDC balance and native gas token balance.

**Inputs:** None

**Output example:**
```json
{
  "address": "0xAgentAddress",
  "chain": "Base",
  "chainId": 8453,
  "usdc": "142.50",
  "usdcRaw": "142500000",
  "gasToken": "ETH",
  "gasBalance": "0.0234",
  "gasBalanceRaw": "23400000000000000"
}
```

### autopay_subscribe

Create an on-chain subscription policy. Charges the first payment immediately. Auto-approves USDC if the current allowance is insufficient.

**Inputs:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `merchant` | `string` | Yes | Merchant EVM address (`0x...`) |
| `amount` | `number` | Yes | USDC per billing cycle (e.g. `10` for 10 USDC) |
| `interval` | `string \| number` | Yes | Preset name or seconds. Presets: `hourly`, `daily`, `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly` |
| `spendingCap` | `number` | No | Max total USDC. `0` = unlimited. Default: `amount * 30` |
| `metadataUrl` | `string` | No | Plan metadata URL |

**Output example:**
```json
{
  "success": true,
  "policyId": "0x...",
  "txHash": "0x...",
  "explorer": "https://basescan.org/tx/0x...",
  "merchant": "0x...",
  "amount": 10,
  "interval": "monthly"
}
```

### autopay_unsubscribe

Cancel an active subscription by revoking the on-chain policy. Takes effect immediately.

**Inputs:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `policyId` | `string` | Yes | Policy ID (bytes32 hex) to cancel |

**Output example:**
```json
{
  "success": true,
  "policyId": "0x...",
  "txHash": "0x...",
  "explorer": "https://basescan.org/tx/0x..."
}
```

### autopay_get_policy

Read the on-chain details of a subscription policy.

**Inputs:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `policyId` | `string` | Yes | Policy ID (bytes32 hex) |

**Output example:**
```json
{
  "policyId": "0x...",
  "active": true,
  "payer": "0x...",
  "merchant": "0x...",
  "chargeAmount": "10.00 USDC",
  "spendingCap": "300.00 USDC",
  "totalSpent": "10.00 USDC",
  "interval": "2592000s",
  "chargeCount": 1,
  "consecutiveFailures": 0,
  "metadataUrl": null
}
```

### autopay_fetch

Fetch a URL. If the server returns HTTP 402 with AutoPay subscription requirements, automatically subscribes and retries with a signed Bearer token. Cached subscriptions are reused across calls.

**Inputs:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | Yes | URL to fetch |
| `method` | `string` | No | HTTP method: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`. Default: `GET` |
| `headers` | `object` | No | Request headers as key-value pairs |
| `body` | `string` | No | Request body (for POST/PUT/PATCH) |

**Output:** Returns the HTTP status line followed by the response body. Very large responses (>50K chars) are truncated.

This is the primary tool for agents interacting with paid APIs. The flow:
1. Fetches the URL
2. If HTTP 402 with an `autopay` discovery block: subscribes to the merchant's plan
3. Retries the original request with `Authorization: Bearer {token}`
4. Subsequent calls to the same merchant reuse the cached subscription

### autopay_approve_usdc

Pre-approve USDC spending to the PolicyManager contract. Usually not needed — `autopay_subscribe` auto-approves.

**Inputs:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `amount` | `number` | No | USDC to approve (e.g. `100`). Default: unlimited |

### autopay_bridge_usdc

Bridge USDC from another chain to the agent's configured chain via LiFi.

**Inputs:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fromChainId` | `number` | Yes | Source chain ID |
| `amount` | `number` | Yes | USDC amount to bridge |
| `sourceRpcUrl` | `string` | Yes | RPC URL for the source chain |
| `slippage` | `number` | No | Slippage tolerance in %. Default: `0.5` |

**Supported source chains:**

| Chain | ID |
|-------|----|
| Ethereum | 1 |
| Optimism | 10 |
| Polygon | 137 |
| Arbitrum | 42161 |
| Avalanche | 43114 |
| BSC | 56 |
| Base | 8453 |
| Flow EVM | 747 |

**Output example:**
```json
{
  "success": true,
  "sourceTxHash": "0x...",
  "destinationTxHash": "0x...",
  "fromChainId": 1,
  "toChainId": 8453,
  "fromAmount": "50.00 USDC",
  "toAmount": "49.85 USDC",
  "durationMs": 120000
}
```

### autopay_swap_native_to_usdc

Swap native tokens (FLOW, ETH, etc.) to USDC on the agent's configured chain via LiFi.

**Inputs:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `amount` | `number` | Yes | Native token amount (e.g. `1` for 1 ETH/FLOW) |
| `slippage` | `number` | No | Slippage tolerance in %. Default: `0.5` |

**Output example:**
```json
{
  "success": true,
  "txHash": "0x...",
  "explorer": "https://basescan.org/tx/0x...",
  "nativeAmount": "1.00 ETH",
  "usdcAmount": "2450.00 USDC",
  "durationMs": 15000
}
```

## Architecture

The MCP server is a thin wrapper around `@autopayprotocol/agent-sdk`:

1. On startup, initializes an `AutoPayAgent` from environment variables
2. Creates a `wrapFetchWithSubscription` instance for the `autopay_fetch` tool
3. Registers all 8 tools with the MCP SDK
4. Communicates over stdio using the MCP protocol

The server maintains subscription state in memory. Subscriptions are cached across `autopay_fetch` calls within the same session but lost on restart (since the MCP server is typically ephemeral).

## Supported Chains

| Chain | Key | Chain ID | PolicyManager |
|-------|-----|----------|---------------|
| Base | `base` | 8453 | `0x037A24595E96B10d9FB2c7c2668FE5e7F354c86a` |
| Flow EVM | `flowEvm` | 747 | `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345` |
| Base Sepolia | `baseSepolia` | 84532 | `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345` |

## Error Handling

All tools return structured error responses with `isError: true` when something goes wrong. The error message includes the underlying cause.

Common errors:
- **Balance check failed**: RPC connection issues
- **Subscribe failed: Insufficient USDC balance**: Agent needs more USDC
- **Subscribe failed: No native token balance for gas**: Agent needs gas tokens
- **Bridge failed: No USDC address known for source chain**: Unsupported source chain
- **Fetch failed**: Network error or target service unreachable
