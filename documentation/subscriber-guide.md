# Subscriber Guide

This guide explains how AutoPay subscriptions work from the subscriber's perspective - how to subscribe, manage, and cancel your subscriptions.

---

## Getting Started

### 1. Connect Your Wallet

Connect using any Ethereum-compatible wallet via RainbowKit (MetaMask, Rabby, WalletConnect, Coinbase Wallet, and more). No special wallet or passkey required - just the browser wallet you already use.

![Wallet connection modal](/doc-imgs/wallet-connect.png)

### 2. Fund Your Wallet

Your wallet needs USDC on the consolidation chain (the chain where the merchant's subscriptions settle, e.g. Flow EVM). If your USDC is on another chain, use the built-in LiFi bridge widget to transfer it. 30+ source chains are supported (Ethereum, Arbitrum, Base, Polygon, Optimism, Avalanche, and more).

![LiFi bridge widget](/doc-imgs/lifi-bridge.png)

### 3. Approve USDC Spending

The first time you use AutoPay, you'll approve the AutoPay smart contract to charge USDC from your wallet. This is a one-time setup step.

**Is this safe?** Yes. The smart contract can only charge you according to active subscription policies that you've created. It cannot drain your wallet or charge you arbitrary amounts. See [Safety & Protections](#safety-protections) below for details.

![USDC approval screen](/doc-imgs/usdc-approval.png)

### 4. Subscribe

When you subscribe to a service, a **policy** is created on-chain. This policy defines:

- **How much** you'll be charged (e.g., 10 USDC)
- **How often** (e.g., every 30 days)
- **Maximum total** (e.g., 120 USDC over the lifetime)

The first payment is charged immediately when you subscribe.

---

## Managing Subscriptions

### Viewing Your Subscriptions

Your dashboard shows all active and past subscriptions, including:

- Plan name and merchant
- Charge amount and billing interval
- Next charge date
- Total spent vs spending cap
- Subscription status (active, cancelled, failed)

![Subscriber dashboard](/doc-imgs/subscriber-dashboard.png)

### Activity Feed

The activity feed shows a chronological history of all subscription events:

- New subscriptions created
- Successful charges (recurring payments)
- Cancellations
- Failed charge attempts

Each entry links to the on-chain transaction for full transparency.

![Activity feed](/doc-imgs/activity-feed.png)

---

## Cancelling a Subscription

You can cancel any subscription at any time. Cancellation is **instant** - no waiting periods, no confirmation emails, no "are you sure?" loops.

To cancel:
1. Go to your subscriptions dashboard
2. Find the subscription you want to cancel
3. Click **Cancel Subscription**
4. Confirm the transaction in your wallet

![Subscription detail with cancel button](/doc-imgs/subscription-detail.png)

After cancellation:
- No future charges will be made
- The merchant is notified immediately
- Whether you retain access until the end of the billing period depends on the merchant's policy

> **Note:** AutoPay does not process refunds for past charges. Contact the merchant directly for refund requests.

---

## What Happens When a Charge Fails

A charge can fail if your wallet doesn't have enough USDC when the payment is due.

### Retry Process

1. **First failure** - The system retries after a short delay. You are not notified yet.
2. **Second failure** - Another retry. The merchant may notify you to add funds.
3. **Third failure** - The subscription is **automatically cancelled** on-chain.

### How to Avoid Failed Charges

- Keep enough USDC in your wallet to cover upcoming charges
- Check your dashboard before charges are due (the next charge date is displayed)
- If a charge fails, add USDC before the next retry to keep your subscription active

### After Auto-Cancellation

If your subscription is cancelled due to failed payments:
- You'll need to create a new subscription to resume service
- The merchant decides whether to restore your access or require re-subscribing

---

## Safety & Protections

AutoPay is designed to protect subscribers. Here's how:

### Your Funds Stay in Your Wallet

AutoPay is **non-custodial**. Your USDC remains in your wallet at all times. The smart contract only pulls the exact charge amount at the scheduled interval. No one - not AutoPay, not the merchant - can access your funds outside of your active subscription policies.

### Spending Caps

Every subscription has a **spending cap** - a hard limit on the total amount that can ever be charged. Once the cap is reached, no more charges can be made. For example, a 10 USDC/month plan with a 120 USDC cap will stop after 12 charges.

### Fixed Charge Amounts

The charge amount is locked when you subscribe. Merchants **cannot increase the price** of an existing subscription. If a merchant wants to change pricing, they'd need you to cancel and re-subscribe to a new plan.

### Time Intervals

A minimum time must pass between each charge. If your plan bills monthly, the contract enforces that at least 30 days pass between charges. No double-billing is possible.

### Instant Cancellation

You can cancel any subscription at any time with a single transaction. There are no cancellation fees, waiting periods, or approval processes. Once cancelled, no further charges can be made.

### On-Chain Transparency

Every charge is an on-chain transaction that you can verify on a block explorer. You'll always have a complete, tamper-proof record of every payment made.

### Auto-Cancel on Failure

If 3 consecutive charges fail (because your wallet balance is low), the subscription is automatically cancelled. This prevents charges from silently accumulating.

---

## Understanding Fees

When you subscribe to a 10 USDC/month plan, you pay 10 USDC. The fee breakdown is:

| | Amount |
|---|---|
| **You pay** | 10.00 USDC |
| Merchant receives | 9.75 USDC |
| Protocol fee (2.5%) | 0.25 USDC |

The protocol fee is included in the charge amount - you don't pay extra on top of the stated price. You'll also need a small amount of the chain's native token for gas fees (FLOW on Flow EVM, ETH on Base), typically less than $0.01 per transaction.

---

## FAQ

<details>
<summary>Is my money safe?</summary>

Yes. Your USDC stays in your wallet. The smart contract can only charge according to the exact terms of your active subscriptions. You can cancel at any time.

</details>

<details>
<summary>Can a merchant charge me more than the agreed amount?</summary>

No. The charge amount is locked in the smart contract when you subscribe. The merchant cannot change it.

</details>

<details>
<summary>What if I want a refund?</summary>

AutoPay does not handle refunds - contact the merchant directly. Since all charges are on-chain, there's a clear record of every payment.

</details>

<details>
<summary>What happens if I lose access to my wallet?</summary>

Your subscriptions are tied to your wallet address. If you lose access to your wallet, your old subscriptions will fail after 3 missed charges and auto-cancel. Consult your wallet provider's recovery options (seed phrase, social recovery, etc.).

</details>

<details>
<summary>Can I have multiple subscriptions?</summary>

Yes. You can have as many active subscriptions as you want, to different merchants and plans. Each is an independent policy with its own terms and spending cap.

</details>

<details>
<summary>What blockchain does this use?</summary>

AutoPay deploys to **consolidation chains** (EVM chains where subscriptions settle). Currently live on **Base Mainnet** (primary) and **Flow EVM Mainnet**. You can bridge USDC from 30+ chains (Ethereum, Arbitrum, Polygon, Optimism, Avalanche, and more) using the built-in LiFi bridge widget.

</details>

<details>
<summary>Do I need ETH or other tokens for gas?</summary>

You'll need a tiny amount of the chain's native token for gas (FLOW on Flow EVM, ETH on Base). Gas costs are typically under $0.01 per transaction. Your main balance should be in USDC.

</details>

<details>
<summary>How do I see my on-chain transactions?</summary>

Your activity feed shows transaction hashes that link to the block explorer for the consolidation chain (e.g. [Flowscan](https://evm.flowscan.io) for Flow EVM), where you can verify every charge independently.

</details>
