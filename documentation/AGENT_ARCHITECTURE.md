# AutoPay Agent Architecture

How AI agents discover, subscribe to, and use services through AutoPay.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Current Architecture](#current-architecture)
3. [Agent Subscription Lifecycle](#agent-subscription-lifecycle)
4. [Three Ways to Integrate](#three-ways-to-integrate)
5. [Service-Side Verification](#service-side-verification)
6. [How Agents Discover AutoPay](#how-agents-discover-autopay)
7. [AutoPay vs x402](#autopay-vs-x402)
8. [Using Both Together](#using-both-together)
9. [Implementation Status](#implementation-status)
10. [Remaining Friction Points](#remaining-friction-points)

---

## System Overview

AutoPay is a non-custodial recurring payment protocol. An AI agent subscribes once and gets ongoing access — the relayer handles renewals automatically. No payment logic in the agent's hot path.

```mermaid
graph TB
    subgraph "Agent Side"
        A[AI Agent<br/>EOA Wallet]
    end

    subgraph "On-Chain (Flow EVM / Base)"
        U[USDC Contract]
        P[PolicyManager<br/>Contract]
    end

    subgraph "Off-Chain"
        R[AutoPay Relayer<br/>Charge Executor]
        S[Service / API<br/>Merchant]
    end

    A -->|"1. approve()"| U
    A -->|"2. createPolicy()"| P
    P -->|"3. First charge<br/>(same tx)"| U
    U -->|"USDC transfer"| S

    R -->|"4. charge() on schedule"| P
    P -->|"USDC transfer"| U
    U -->|"Recurring payment"| S

    A -->|"5. Bearer policyId"| S
    S -->|"6. policies() read"| P
    S -->|"200 OK + data"| A

    A -->|"7. revokePolicy()"| P

    style A fill:#1a1a2e,color:#fff
    style P fill:#0052FF,color:#fff
    style U fill:#2775CA,color:#fff
    style R fill:#16A34A,color:#fff
    style S fill:#86868B,color:#fff
```

### Key Properties

| Property | Detail |
|----------|--------|
| **Non-custodial** | USDC stays in agent wallet until the moment a charge executes |
| **On-chain enforcement** | Spending caps, intervals, and max retries are enforced by the contract |
| **Agent-initiated** | Agent creates and cancels subscriptions; relayer only executes scheduled charges |
| **No identity** | Wallet address is the only identifier. No KYC, no accounts, no API keys |
| **Multi-chain** | PolicyManager deployed on Flow EVM (747), Base (8453), and Base Sepolia (84532) |

---

## Current Architecture

What exists today, component by component.

```mermaid
graph LR
    subgraph "Implemented ✅"
        C[PolicyManager<br/>Contract]
        RE[Relayer<br/>Charge Executor]
        MS[Merchant SDK<br/>@autopayprotocol/sdk]
        AS[Agent SDK<br/>@autopayprotocol/agent-sdk]
        MCP[MCP Server<br/>@autopayprotocol/mcp]
        WF[wrapFetchWithSubscription<br/>Transparent 402 Handler]
        EX[Examples<br/>agent.js + agent-wrapped.js]
        DOC[Docs<br/>AGENT_SUBSCRIPTIONS.md]
        PE[Relayer Payer<br/>Query Endpoint]
        MW[Middleware<br/>npm Package]
    end

    C --- RE
    C --- AS
    AS --- MCP
    AS --- WF
    AS --- EX
    MW --- EX

    style C fill:#16A34A,color:#fff
    style RE fill:#16A34A,color:#fff
    style MS fill:#16A34A,color:#fff
    style AS fill:#16A34A,color:#fff
    style MCP fill:#16A34A,color:#fff
    style WF fill:#16A34A,color:#fff
    style EX fill:#16A34A,color:#fff
    style DOC fill:#16A34A,color:#fff
    style PE fill:#16A34A,color:#fff
    style MW fill:#16A34A,color:#fff
```

### What's Live

| Component | Status | What It Does | Code Location |
|-----------|--------|--------------|---------------|
| **PolicyManager contract** | Deployed | `createPolicy()`, `revokePolicy()`, `charge()`, `canCharge()`, `policies()` getter | `contracts/src/ArcPolicyManager.sol` |
| **Relayer** | Running | Indexes events, executes charges on schedule, sends webhooks | `relayer/src/` |
| **Merchant SDK** | Published on npm | Checkout URLs, webhook verification, fee calculations | `packages/sdk/` |
| **Agent SDK** | Built | `AutoPayAgent` class — subscribe, unsubscribe, getPolicy, balance checks, typed errors | `packages/agent-sdk/` |
| **MCP server** | Built | 7 tools for AI agents (balance, subscribe, unsubscribe, get_policy, fetch, approve, bridge_usdc) | `packages/mcp/` |
| **`wrapFetchWithSubscription`** | Built | Transparent HTTP 402 → subscribe → retry wrapper, with optional auto-bridge | `packages/agent-sdk/src/fetch.ts` |
| **Cross-chain bridging** | Built | `bridgeUsdc()` on `AutoPayAgent`, LiFi REST API, auto-bridge in fetch wrapper | `packages/agent-sdk/src/bridge.ts` |
| **Agent examples** | Working | Manual flow (`agent.js`) + zero-boilerplate flow (`agent-wrapped.js`) + bridge flow (`agent-with-bridge.js`) + service | `examples/agent-subscription/` |
| **Relayer payer endpoint** | Built | `GET /payers/:address/policies?chain_id=N` — agents can list their subscriptions | `relayer/src/api/index.ts` |
| **Middleware package** | Built | `@autopayprotocol/middleware` — `requireSubscription()` Express middleware + core verifier | `packages/middleware/` |

---

## Agent Subscription Lifecycle

The full flow from first contact to cancellation.

```mermaid
sequenceDiagram
    participant Agent as AI Agent
    participant Service as Data Service
    participant USDC as USDC Contract
    participant PM as PolicyManager
    participant Relayer as AutoPay Relayer

    Note over Agent,Service: Step 1: Discovery
    Agent->>Service: GET /api/data
    Service-->>Agent: 402 Payment Required<br/>{ accepts: ["autopay"], autopay: { plans, networks } }

    Note over Agent,PM: Step 2: Subscribe (auto-approves if needed)
    Agent->>USDC: approve(PolicyManager, amount) [if needed]
    USDC-->>Agent: tx confirmed
    Agent->>PM: createPolicy(merchant, 10 USDC, monthly, 120 USDC cap)
    PM->>USDC: transferFrom(agent → merchant) [first charge]
    PM-->>Agent: PolicyCreated event → policyId

    Note over Agent,Service: Step 3: Use the Service
    loop Every request
        Agent->>Service: GET /api/data<br/>Authorization: Bearer {policyId}
        Service->>PM: policies(policyId) [free read]
        PM-->>Service: { active: true, merchant: 0x... }
        Service-->>Agent: 200 OK + data
    end

    Note over Relayer,PM: Step 4: Auto-Renewal (agent does nothing)
    loop Every billing period
        Relayer->>PM: charge(policyId)
        PM->>USDC: transferFrom(agent → merchant)
        PM-->>Relayer: ChargeSucceeded event
    end

    Note over Agent,PM: Step 5: Cancel
    Agent->>PM: revokePolicy(policyId)
    PM-->>Agent: PolicyRevoked event

    Agent->>Service: GET /api/data<br/>Authorization: Bearer {policyId}
    Service->>PM: policies(policyId) [free read]
    PM-->>Service: { active: false }
    Service-->>Agent: 402 Payment Required
```

### On-Chain Operations (Agent Pays Gas)

| Operation | Contract Call | Gas Cost | When |
|-----------|-------------|----------|------|
| Approve USDC | `USDC.approve(PolicyManager, amount)` | ~45,000 gas | Auto-handled by `subscribe()` if needed |
| Subscribe | `PM.createPolicy(...)` | ~120,000 gas | Once per subscription |
| Cancel | `PM.revokePolicy(policyId)` | ~40,000 gas | Once per subscription |
| Check status | `PM.policies(policyId)` | 0 (view call) | Every verification |

Gas costs on Base: ~5-20 cents per write. On Flow EVM: <1 cent per write.

### Off-Chain Operations (Free)

| Operation | Method | When |
|-----------|--------|------|
| Discover subscription options | `GET /api/... → 402` | On first contact |
| Use service | `GET /api/... + Bearer token` | Every request |
| Verify subscription (service-side) | `readContract policies()` | Every request (cached) |

---

## Three Ways to Integrate

### 1. MCP Server (AI Agents via Claude / LLM)

For AI agents using the Model Context Protocol — zero code required from the agent developer:

```json
{
  "mcpServers": {
    "autopay": {
      "command": "npx",
      "args": ["@autopayprotocol/mcp"],
      "env": {
        "AUTOPAY_PRIVATE_KEY": "0xYOUR_KEY",
        "AUTOPAY_CHAIN": "base"
      }
    }
  }
}
```

The MCP server exposes 7 tools:

| Tool | Description |
|------|-------------|
| `autopay_balance` | Check USDC + gas balance |
| `autopay_subscribe` | Create subscription (auto-approves USDC) |
| `autopay_unsubscribe` | Cancel subscription |
| `autopay_get_policy` | Read policy details |
| `autopay_fetch` | Fetch URL with transparent 402 handling |
| `autopay_approve_usdc` | Explicit USDC pre-approval |
| `autopay_bridge_usdc` | Bridge USDC from another chain via LiFi |

### 2. `wrapFetchWithSubscription` (Zero-Boilerplate)

For programmatic agents that use `fetch` — wrap it once, 402 handling is automatic:

```typescript
import { AutoPayAgent, wrapFetchWithSubscription } from '@autopayprotocol/agent-sdk'

const agent = new AutoPayAgent({
  privateKey: process.env.KEY as `0x${string}`,
  chain: 'base',
})

const fetchWithPay = wrapFetchWithSubscription(fetch, agent)

// Just fetch — 402 → subscribe → retry is transparent
const res = await fetchWithPay('https://api.service.com/data')
```

> **Note:** The wrapper subscribes on the agent's configured chain. It does not read the `networks` array from the 402 body. Ensure the agent's chain matches what the service supports.

### 3. Direct SDK (Full Control)

For agents that need explicit control over every step — discover plans via 402, then subscribe:

```typescript
import { AutoPayAgent } from '@autopayprotocol/agent-sdk'

const agent = new AutoPayAgent({
  privateKey: process.env.KEY as `0x${string}`,
  chain: 'base',
})

// Step 1: Hit the service — get 402 with plan details
const discovery = await fetch('https://api.service.com/data')
if (discovery.status === 402) {
  const body = await discovery.json()
  const plan = body.autopay.plans[0] // Merchant-defined plan

  // Step 2: Subscribe using the plan details from the 402 response
  const sub = await agent.subscribe({
    merchant: body.autopay.merchant,
    amount: Number(plan.amount),
    interval: plan.interval,
    spendingCap: Number(plan.amount) * 30,
    metadataUrl: plan.metadataUrl,
  })

  // Step 3: Use the service with the subscription
  const res = await fetch('https://api.service.com/data', {
    headers: { Authorization: `Bearer ${sub.policyId}` },
  })

  // Step 4: Cancel when done
  await agent.unsubscribe(sub.policyId)
}
```

---

## Service-Side Verification

How a service confirms an agent has a valid subscription.

```mermaid
flowchart TD
    A[Request arrives] --> B{Authorization<br/>header present?}
    B -->|No| C[Return 402<br/>+ discovery payload]
    B -->|Yes| D[Extract policyId<br/>from Bearer token]

    D --> E{In cache<br/>and fresh?}
    E -->|Yes| F{Cached as<br/>active?}
    E -->|No| G[Read on-chain<br/>policies policyId]

    G --> H{active == true?}
    H -->|No| C
    H -->|Yes| I{merchant matches<br/>our address?}

    F -->|No| C
    F -->|Yes| I

    I -->|No| J[Return 403<br/>Wrong merchant]
    I -->|Yes| K[Cache result<br/>TTL: 60s]
    K --> L[Serve data<br/>200 OK]

    style C fill:#dc2626,color:#fff
    style J fill:#dc2626,color:#fff
    style L fill:#16A34A,color:#fff
```

### Policy Struct Reference

The `policies(bytes32)` getter returns a 12-field tuple. Services read index 10 (`active`) for gating:

```
Index  Field                  Type       Used For
──────────────────────────────────────────────────
0      payer                  address    Who's being charged
1      merchant               address    Who receives payment
2      chargeAmount           uint128    USDC per charge (6 decimals)
3      spendingCap            uint128    Max total spend (0 = unlimited)
4      totalSpent             uint128    Running total
5      interval               uint32     Seconds between charges
6      lastCharged            uint32     Timestamp of last charge
7      chargeCount            uint32     Successful charge count
8      consecutiveFailures    uint8      Soft-fail streak
9      endTime                uint32     0 = still active
10     active                 bool       ← SERVICE CHECKS THIS
11     metadataUrl            string     Off-chain metadata
```

### Verification with Agent SDK

Services can import ABIs directly from the agent SDK:

```typescript
import { createPublicClient, http } from 'viem'
import { POLICY_MANAGER_ABI, chains } from '@autopayprotocol/agent-sdk'

const chain = chains.base
const client = createPublicClient({
  transport: http(chain.rpcUrl),
})

async function isActiveSubscription(policyId: `0x${string}`): Promise<boolean> {
  const policy = await client.readContract({
    address: chain.policyManager,
    abi: POLICY_MANAGER_ABI,
    functionName: 'policies',
    args: [policyId],
  })
  const [, merchant, , , , , , , , , active] = policy
  return active && merchant.toLowerCase() === MERCHANT_ADDRESS.toLowerCase()
}
```

---

## How Agents Discover AutoPay

### HTTP 402 Discovery

When an agent hits a protected endpoint, the service responds with subscription options:

```mermaid
sequenceDiagram
    participant Agent as AI Agent
    participant Service as Protected API

    Agent->>Service: GET /api/data
    Service-->>Agent: 402 Payment Required

    Note right of Agent: Agent parses 402 body:
    Note right of Agent: {<br/>  "accepts": ["autopay"],<br/>  "autopay": {<br/>    "merchant": "0x...",<br/>    "plans": [...],<br/>    "networks": [...]<br/>  }<br/>}

    Note right of Agent: wrapFetchWithSubscription<br/>handles this automatically

    Agent->>Service: GET /api/data<br/>Authorization: Bearer {policyId}
    Service-->>Agent: 200 OK + data
```

### 402 Response Schema

```json
{
  "error": "Subscription required",
  "accepts": ["autopay"],
  "autopay": {
    "type": "subscription",
    "merchant": "0xServiceAddress",
    "plans": [
      {
        "name": "Basic",
        "amount": "10",
        "currency": "USDC",
        "interval": 2592000,
        "metadataUrl": "https://api.service.com/plans/basic.json"
      }
    ],
    "networks": [
      {
        "chainId": 8453,
        "name": "Base",
        "policyManager": "0x037A24595E96B10d9FB2c7c2668FE5e7F354c86a",
        "usdc": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
      },
      {
        "chainId": 747,
        "name": "Flow EVM",
        "policyManager": "0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345",
        "usdc": "0xF1815bd50389c46847f0Bda824eC8da914045D14"
      }
    ]
  }
}
```

### MCP Tool Discovery

AI agents using the Model Context Protocol discover AutoPay as a set of tools:

```mermaid
sequenceDiagram
    participant LLM as LLM (Claude)
    participant MCP as AutoPay MCP Server
    participant Chain as Blockchain

    LLM->>MCP: list_tools()
    MCP-->>LLM: [autopay_balance, autopay_subscribe,<br/>autopay_unsubscribe, autopay_get_policy,<br/>autopay_fetch, autopay_approve_usdc,<br/>autopay_bridge_usdc]

    LLM->>MCP: autopay_fetch({<br/>  url: "https://api.service.com/data"<br/>})
    Note right of MCP: Service returns 402<br/>MCP auto-subscribes<br/>and retries
    MCP->>Chain: approve() + createPolicy()
    Chain-->>MCP: policyId
    MCP-->>LLM: HTTP 200 OK + data
```

---

## AutoPay vs x402

### Architectural Difference

```mermaid
graph TB
    subgraph "x402: Pay-Per-Request"
        A1[Agent] -->|"1. GET /data"| S1[Service]
        S1 -->|"2. 402 + price"| A1
        A1 -->|"3. Sign payment"| A1
        A1 -->|"4. GET /data + PAYMENT-SIGNATURE"| S1
        S1 -->|"5. Settle on-chain"| F1[Facilitator]
        F1 -->|"6. Confirmed"| S1
        S1 -->|"7. 200 + data"| A1
    end

    subgraph "AutoPay: Subscribe Once"
        A2[Agent] -->|"1. createPolicy() [one tx]"| P2[PolicyManager]
        A2 -->|"2. GET /data + Bearer policyId"| S2[Service]
        S2 -->|"3. policies() [free read]"| P2
        S2 -->|"4. 200 + data"| A2
        R2[Relayer] -->|"5. charge() monthly"| P2
    end

    style F1 fill:#7C3AED,color:#fff
    style P2 fill:#0052FF,color:#fff
    style R2 fill:#16A34A,color:#fff
```

### Comparison Table

| Dimension | x402 | AutoPay |
|-----------|------|---------|
| **Payment model** | Per-request micropayment | Recurring subscription |
| **Who initiates payment** | Client (signs every request) | Relayer (charges on schedule) |
| **On-chain txs per access** | 1 per request | 1 per billing period |
| **Agent complexity** | Payment logic in every request | Subscribe once, use freely |
| **Cost at high frequency** | Gas * N requests | Gas * 1 subscription |
| **State** | Stateless (each payment is atomic) | Stateful (policy tracks billing) |
| **Spending controls** | None built-in (agent self-enforces) | On-chain: cap, interval, max retries |
| **Merchant can pull funds** | No (client always pays) | Yes (relayer calls charge()) |
| **Cancellation** | Stop paying | `revokePolicy()` — immediate |
| **SDK** | `@x402/fetch`, `@x402/express` | `@autopayprotocol/agent-sdk`, `@autopayprotocol/mcp` |
| **Transparent fetch wrapper** | `wrapFetchWithPayment` | `wrapFetchWithSubscription` |
| **MCP server** | Via x402 MCP tools | `@autopayprotocol/mcp` (7 tools) |
| **Supported chains** | Base, Ethereum, Optimism, Polygon, Arbitrum, Avalanche, Solana | Flow EVM, Base, Base Sepolia |
| **Best for** | One-off lookups, unpredictable usage, micropayments | Ongoing access, predictable costs, high-frequency use |

### Cost Comparison

For an agent accessing a data API 1,000 times/month:

| Scenario | x402 Cost | AutoPay Cost |
|----------|----------|--------------|
| API price: $0.001/request | $1.00 + gas * 1,000 | $10/month + gas * 1 |
| API price: $0.01/request | $10.00 + gas * 1,000 | $10/month + gas * 1 |
| API price: $0.05/request | $50.00 + gas * 1,000 | $10/month + gas * 1 |

At ~1,000 requests, x402 gas costs alone ($0.01-0.05/tx on Base) can exceed the AutoPay subscription. The crossover point depends on per-request price and frequency — low-frequency casual use favors x402, high-frequency ongoing use favors AutoPay.

---

## Using Both Together

A service can accept both x402 (one-off) and AutoPay (subscription) payments:

```mermaid
flowchart TD
    A[Request arrives] --> B{Has AutoPay<br/>Bearer token?}
    B -->|Yes| C{Active<br/>subscription?}
    C -->|Yes| D[Serve data<br/>200 OK]
    C -->|No| E[Fall through]

    B -->|No| E
    E --> F{Has x402<br/>PAYMENT-SIGNATURE?}
    F -->|Yes| G{Payment<br/>valid?}
    G -->|Yes| D
    G -->|No| H[402 with both options]

    F -->|No| H

    H --> I["402 body:<br/>{<br/>  accepts: [x402, autopay],<br/>  x402: { price, network },<br/>  autopay: { plans, networks }<br/>}"]

    style D fill:#16A34A,color:#fff
    style H fill:#dc2626,color:#fff
```

```typescript
// Dual-protocol service middleware
async function handleRequest(req, res) {
  // Check AutoPay subscription first (cheaper for frequent users)
  const policyId = req.headers.authorization?.replace('Bearer ', '')
  if (policyId && await isActiveSubscription(policyId)) {
    return serveRequest(req, res)
  }

  // Fall back to x402 per-request payment
  const payment = req.headers['x-payment']
  if (payment && await verifyX402Payment(payment)) {
    return serveRequest(req, res)
  }

  // No payment — return 402 with both options
  res.status(402).json({
    accepts: ['x402', 'autopay'],
    x402: { price: '$0.01', network: 'base', token: 'USDC' },
    autopay: { merchant: '0x...', plans: [...], networks: [...] },
  })
}
```

---

## Implementation Status

### Detailed Status Matrix

| Layer | Component | Status | Code Location |
|-------|-----------|--------|---------------|
| **Contract** | PolicyManager | Deployed | `contracts/src/ArcPolicyManager.sol` |
| **Contract** | All agent functions (create, revoke, read) | Working | Same |
| **Contract** | Spending caps, intervals, auto-cancel | Working | Same |
| **Relayer** | Event indexing | Running | `relayer/src/indexer/` |
| **Relayer** | Charge execution | Running | `relayer/src/executor/` |
| **Relayer** | Webhooks | Running | `relayer/src/webhooks/` |
| **Relayer** | `GET /payers/:address/policies` | Built | `relayer/src/api/index.ts` |
| **SDK** | Merchant SDK (`@autopayprotocol/sdk`) | Published | `packages/sdk/` |
| **SDK** | Agent SDK (`@autopayprotocol/agent-sdk`) | Built | `packages/agent-sdk/` |
| **SDK** | `wrapFetchWithSubscription` | Built | `packages/agent-sdk/src/fetch.ts` |
| **SDK** | Cross-chain bridge (`bridgeUsdc`) | Built | `packages/agent-sdk/src/bridge.ts` |
| **SDK** | `AutoPayAgent` class | Built | `packages/agent-sdk/src/agent.ts` |
| **SDK** | Typed errors | Built | `packages/agent-sdk/src/errors.ts` |
| **MCP** | MCP server (`@autopayprotocol/mcp`) | Built | `packages/mcp/` |
| **MCP** | 7 tools (balance, subscribe, unsubscribe, get_policy, fetch, approve, bridge_usdc) | Built | `packages/mcp/src/index.ts` |
| **Middleware** | `@autopayprotocol/middleware` | Built | `packages/middleware/` |
| **Middleware** | Express `requireSubscription` | Built | `packages/middleware/src/express.ts` |
| **Example** | Manual agent flow | Working | `examples/agent-subscription/agent.js` |
| **Example** | Zero-boilerplate agent flow | Working | `examples/agent-subscription/agent-wrapped.js` |

### Package Details

| Package | Version | Build | Peer Deps |
|---------|---------|-------|-----------|
| `@autopayprotocol/agent-sdk` | 0.1.0 | ESM + CJS via tsup | `viem ^2.0.0` |
| `@autopayprotocol/mcp` | 0.1.0 | ESM + CJS via tsup (with shebang) | — |
| `@autopayprotocol/middleware` | 0.1.0 | ESM + CJS via tsup | `viem ^2.0.0` |
| `@autopayprotocol/sdk` | Published | ESM + CJS via tsup | None |

---

## Remaining Friction Points

What's been resolved and what's still open.

### Resolved

| Friction | Solution |
|----------|----------|
| Raw viem calls required | `AutoPayAgent` class wraps everything — `subscribe()`, `unsubscribe()`, `getPolicy()`, etc. |
| Event log parsing | SDK extracts `policyId` from `PolicyCreated` event internally |
| Nonce management | SDK sequences approve → createPolicy automatically |
| Opaque errors | Typed errors: `InsufficientBalanceError`, `InsufficientGasError`, `PolicyNotFoundError`, etc. |
| No transparent fetch wrapper | `wrapFetchWithSubscription` handles 402 → subscribe → retry automatically |
| LLMs can't discover AutoPay | MCP server with 6 tools — Claude/other LLM agents can subscribe via tool calls |
| No balance/gas pre-checks | `subscribe()` checks USDC balance and gas before transacting |
| 402 discovery not implemented | `wrapFetchWithSubscription` parses 402 bodies and auto-subscribes |
| Cross-chain bridging | `bridgeUsdc()` on `AutoPayAgent` + `autopay_bridge_usdc` MCP tool + auto-bridge in `wrapFetchWithSubscription` — all via LiFi REST API |

### Still Open

| Friction | Severity | Note |
|----------|----------|------|
| Agent needs an EOA wallet | High | Fundamental requirement of any on-chain protocol. Could be mitigated with account abstraction or embedded wallets. |
| Agent needs USDC | High | On-ramping is outside AutoPay's scope. Could integrate with fiat-to-USDC providers later. |
| Agent framework integrations | Low | No LangChain tool, CrewAI integration, or OpenAI function schema yet. |

---

## Contract Addresses

| Chain | Chain ID | PolicyManager | USDC |
|-------|----------|---------------|------|
| Flow EVM | 747 | `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345` | `0xF1815bd50389c46847f0Bda824eC8da914045D14` |
| Base | 8453 | `0x037A24595E96B10d9FB2c7c2668FE5e7F354c86a` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia | 84532 | `0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

## Key Constants

| Constant | Value | Note |
|----------|-------|------|
| `PROTOCOL_FEE_BPS` | 250 | 2.5% fee on every charge |
| `MIN_INTERVAL` | 60 seconds | 1 minute minimum billing cycle |
| `MAX_INTERVAL` | 31,536,000 seconds | 365 days |
| `MAX_RETRIES` | 3 | Consecutive failures before auto-cancel |

## Interval Presets

| Preset | Seconds |
|--------|---------|
| `hourly` | 3,600 |
| `daily` | 86,400 |
| `weekly` | 604,800 |
| `biweekly` | 1,209,600 |
| `monthly` | 2,592,000 |
| `quarterly` | 7,776,000 |
| `yearly` | 31,536,000 |

---

*Last updated: March 2026*
