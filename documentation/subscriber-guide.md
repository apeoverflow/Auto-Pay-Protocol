# Subscriber Guide

This guide explains how AutoPay subscriptions work from the subscriber's perspective - how to subscribe, manage, and cancel your subscriptions.

---

## Getting Started

### 1. Create a Wallet

When you first visit an AutoPay-powered checkout, you'll create a wallet using a **passkey** (like Face ID or fingerprint). No seed phrases, no browser extensions - just your biometric.

This creates a smart wallet tied to your device. Your wallet address is the same across all supported chains.

### 2. Fund Your Wallet

Your wallet needs USDC to pay for subscriptions. You can transfer USDC from another wallet or purchase it through an exchange.

> **Testnet:** During the testnet phase, you can get free test USDC from the faucet to try things out.

### 3. Approve USDC Spending

The first time you use AutoPay, you'll approve the AutoPay smart contract to charge USDC from your wallet. This is a one-time setup step.

**Is this safe?** Yes. The smart contract can only charge you according to active subscription policies that you've created. It cannot drain your wallet or charge you arbitrary amounts. See [Safety & Protections](#safety--protections) below for details.

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

### Activity Feed

The activity feed shows a chronological history of all subscription events:

- New subscriptions created
- Successful charges (recurring payments)
- Cancellations
- Failed charge attempts

Each entry links to the on-chain transaction for full transparency.

---

## Cancelling a Subscription

You can cancel any subscription at any time. Cancellation is **instant** - no waiting periods, no confirmation emails, no "are you sure?" loops.

To cancel:
1. Go to your subscriptions dashboard
2. Find the subscription you want to cancel
3. Click **Cancel**
4. Confirm with your passkey

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

The protocol fee is included in the charge amount - you don't pay extra on top of the stated price. Gas fees for transactions are covered by the service (sponsored via a paymaster), so you don't pay those either.

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
<summary>What happens if I lose access to my device?</summary>

Your wallet is tied to your passkey (biometric). If you lose your device, you may need to set up a new wallet. Your old subscriptions will fail after 3 missed charges and auto-cancel. Consult your passkey provider's recovery options.

</details>

<details>
<summary>Can I have multiple subscriptions?</summary>

Yes. You can have as many active subscriptions as you want, to different merchants and plans. Each is an independent policy with its own terms and spending cap.

</details>

<details>
<summary>What blockchain does this use?</summary>

AutoPay runs on **Arc Testnet** using USDC. You can fund your wallet from 12+ chains (Ethereum, Polygon, Arbitrum, Base, Solana, and more) via Circle Gateway — funds are automatically bridged to Arc.

</details>

<details>
<summary>Do I need ETH or other tokens for gas?</summary>

No. Gas fees are sponsored - you only need USDC in your wallet.

</details>

<details>
<summary>How do I see my on-chain transactions?</summary>

Your activity feed shows transaction hashes that link to the [Arc Testnet Explorer](https://testnet.arcscan.app), where you can verify every charge independently.

</details>
