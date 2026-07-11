# Market Maker Discovery Call — Question Bank

Use case: MMs selling **recurring deal flow / signal access** to clients. Today they manually chase monthly USDC payments. AutoPay replaces that with auto-renewing subscriptions + access revocation on failure.

Goal of the call: understand the pain deeply enough to pitch a white-glove pilot at the end. Don't sell in the first 40 minutes — listen.

---

## 1. Current state — understand the pain

- How many paying clients on deal flow right now?
- What's the average ticket — monthly fee per client?
- How do clients pay you today — manual USDC transfer, wire, invoice, Stripe?
- How often do clients pay late or forget? Roughly what % churn comes from payment friction vs. genuine cancellation?
- Who chases late payers internally? How much time per month does that take?
- Have you ever lost a client purely because the manual payment was a hassle?

## 2. Delivery & access — drives what we need to build

- Where does the deal flow live — Telegram group, Discord, email, custom portal, all of the above?
- How do you grant access today — manually add wallet/handle, or automated?
- How do you revoke access when someone stops paying — manually, or not at all?
- Do clients ever share access (1 sub, multiple seats)? How do you handle that?
- Any access events that need to fire automatically (welcome DM, onboarding doc, etc.)?

## 3. Clients — understand the buyer

- Who are the clients — funds, prop traders, family offices, retail whales?
- Do they already hold USDC, or would paying in stables be new for them?
- Which chain do they prefer — Arbitrum, Base, Ethereum, Solana?
- Are any of them running bots/agents that might want programmatic access?
- Geographic spread — any compliance/jurisdiction sensitivities?

## 4. Pricing & terms

- Is pricing flat monthly, tiered, or per-deal?
- Annual discounts? Trial periods? Refund policy?
- Any clients on bespoke / negotiated deals you'd want to keep off the platform?
- Do you offer multi-month prepay? At a discount?

## 5. Decision & integration

- If this worked end-to-end, when could you switch over — this quarter, next?
- Who else needs to sign off — co-founder, compliance, finance?
- What's the one thing that would make this a no for you?
- Are there integrations (Telegram bot, Discord bot, webhook to your CRM) that would be a hard requirement vs. nice-to-have?

## 6. Land the pilot offer — end of call

Offer:
- **1% fee for first 6 months** (vs. standard 2.5%)
- **White-glove migration** of existing clients — we help onboard each one
- **Direct line to me** for any issue
- **Custom integration work** on the highest-value access hook (Telegram/Discord/portal)

Ask in return:
- Named case study once 30 days of clean operation
- 2–3 warm intros to peer desks running the same playbook
- Honest weekly feedback for the first month

---

## Notes / answers to capture during the call

> Fill this in live — leave bullets, paste quotes verbatim where possible.

- Pain ranking (1–5) on: late payments, churn, manual ops, client experience
- Most-requested feature when you described AutoPay
- Specific objection that came up
- Names / desks they mentioned as peers
- Next-step commitment (demo, pilot start date, contract review)
