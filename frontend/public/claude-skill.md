---
name: autopay-integrate
description: Build AutoPay Protocol integrations by fetching llms.txt and all linked documentation. Use when building merchant servers, checkout flows, webhook handlers, or agent integrations with AutoPay.
argument-hint: "[what to build, e.g. 'Express webhook handler' or 'Next.js checkout page']"
allowed-tools: WebFetch Read Bash Glob Grep Write Edit
---

# AutoPay Protocol Integration Builder

You are helping a developer integrate with AutoPay Protocol. You have access to the full protocol documentation below.

## Step 1: Load the llms.txt index

Here is the protocol index:

!`curl -s https://autopayprotocol.com/llms.txt 2>/dev/null || cat frontend/public/llms.txt 2>/dev/null || echo "Could not fetch llms.txt"`

## Step 2: Fetch the relevant documentation

Based on the user's request (`$ARGUMENTS`), fetch the specific docs you need from the links above using WebFetch. Always fetch these core docs:

1. **SDK Backend Guide** — `https://autopayprotocol.com/docs/sdk-backend.md` (checkout URLs, webhook verification, event handling)
2. **Checkout Example** — `https://autopayprotocol.com/docs/merchant-checkout-example.md` (full working example)

Fetch additional docs based on what the user is building:
- Agent/AI integration → fetch `agent-sdk-quickstart.md`, `agent-sdk-reference.md`, `mcp-reference.md`
- Self-hosting relayer → fetch `relayer-local-setup.md`, `relayer-configuration.md`
- Middleware/gating → fetch `middleware-reference.md`
- General merchant setup → fetch `merchant-guide.md`

## Step 3: Build the integration

Using the fetched documentation as your source of truth, write code that follows the official patterns exactly:

### Critical details to get right:
- **SDK import**: `import { createCheckoutUrl, verifyWebhook, formatUSDC, parseUSDC } from '@autopayprotocol/sdk'`
- **Webhook signature header**: `x-autopay-signature`
- **Webhook body**: Must be raw string/buffer, not parsed JSON
- **Event field**: Use `event.type` (not `event.event`) from `verifyWebhook()` return
- **Success redirect params**: `policy_id` and `tx_hash` (snake_case query params)
- **Event types**: `policy.created`, `charge.succeeded`, `charge.failed`, `policy.revoked`, `policy.completed`, `policy.cancelled_by_failure`
- **On `policy.created`**: Grant access immediately (first charge already happened)
- **On `charge.succeeded`**: Extend access for another billing period
- **On `policy.revoked` / `policy.completed` / `policy.cancelled_by_failure`**: Revoke access
- **Amounts**: Raw values are 6-decimal strings (e.g. `"9990000"` = $9.99). Use `formatUSDC()` / `parseUSDC()`

### What NOT to do:
- Don't parse webhook body as JSON before passing to `verifyWebhook()`
- Don't use camelCase for success redirect params (`policyId` is wrong, `policy_id` is correct)
- Don't ignore `policy.created` — it means the first charge already succeeded
- Don't hardcode chain IDs — use the SDK constants

## User's request

$ARGUMENTS
