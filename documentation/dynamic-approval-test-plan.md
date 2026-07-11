# Dynamic Approval — Manual Test Plan

Scope: the `dynamic-approval` branch (4 commits ahead of `main`). Covers the new on-chain `updateSpendingCap`, the checkout approval picker, the dashboard `WalletAllowanceCard`, the in-detail cap editor, the relayer indexing of `SpendingCapUpdated`, and the `MERCHANT_ADDRESS` / `/api/plans` diagnostics fixes.

Treat each numbered case as one walkthrough. Mark ✅ / ❌ in the box on the left and capture any unexpected behavior in the notes column.

---

## What changed on this branch

Four commits, summarized by layer. Anything not listed here is regression-only.

### Smart contract — `contracts/src/PolicyManager.sol`
- New `updateSpendingCap(bytes32 policyId, uint128 newCap)` external function. Payer-only (`NotPolicyOwner`), policy must be on-chain `active` (`PolicyNotActive`). `newCap == 0` means unlimited. A finite `newCap` must be `>= totalSpent` (strictly: reverts `CapBelowSpent` only when `newCap != 0 && newCap < totalSpent`, so `newCap == totalSpent` is allowed).
- Mutates `policy.spendingCap` only — does not touch `active`, `totalSpent`, or scheduling. Re-enabling a cap-exhausted policy is implicit: the contract never auto-flips `active=false` at cap exhaustion, so raising the cap simply makes the next `charge()` succeed again.
- New event `SpendingCapUpdated(bytes32 indexed policyId, address indexed payer, uint128 oldCap, uint128 newCap)`.
- New error `CapBelowSpent`. Tests added in `contracts/test/PolicyManager.t.sol` (+128 lines).

### Relayer
- `relayer/src/abis/ArcPolicyManager.json` + `relayer/src/types.ts` extended with `SpendingCapUpdated`.
- `relayer/src/indexer/event-parser.ts` — new `parseSpendingCapUpdated` decoder; added to the `ParsedEvent` union and the `parseLog` cascade.
- `relayer/src/indexer/index.ts` — new `SpendingCapUpdated` case calls `updateSpendingCap(...)`. Unknown policies are a silent noop (filtering is implicit: policies for other merchants were never inserted).
- `relayer/src/db/policies.ts` — new pure helper `decideSpendingCapUpdate(existing, newCap)` returning `noop | update-cap | resume`, plus an `updateSpendingCap` writer:
  - **noop**: policy row missing → log warn, skip.
  - **update-cap**: row exists and either stays inactive or stays active → only update `spending_cap`.
  - **resume**: row is `active=false` AND `cancelled_by_failure=false` AND the new cap makes the policy chargeable again (`newCap == 0n || newCap > totalSpent`) → set `spending_cap`, `active=true`, `ended_at=NULL`, `next_charge_at = last_charged_at (or created_at) + interval_seconds`. Rationale documented inline: a cap-exhausted policy is DB-inactive but on-chain-active, so only resumable rows can emit this event.
- New test file `relayer/test/db/policies.test.ts` covering `decideSpendingCapUpdate`.
- `examples/merchant-checkout/merchant-server/server.js`: `MERCHANT_ADDRESS` is trimmed and validated as a 0x-address on boot (fails fast with a clear message). `/api/plans` errors now include the relayer URL and surface the upstream response body in the thrown error.

### Frontend — hooks & config
- New `frontend/src/hooks/useUpdateSpendingCap.ts`: wraps `walletClient.writeContract({ functionName: 'updateSpendingCap', args: [policyId, newCap] })`. Guards: throws on missing wallet / missing `policyManager`. Tempo build is rejected with `"Cap updates are not supported on this wallet yet"`. Exposes `{ updateSpendingCap, hash, status, error, isLoading, reset }`.
- `frontend/src/hooks/useApproval.ts`: now also returns `allowanceLoaded` so consumers can distinguish "not fetched yet" from "fetched and is 0".
- `frontend/src/contexts/WalletContext.tsx`: `setupWallet(chosenAmount?: bigint)` now accepts an optional approval amount; `undefined` keeps prior unlimited behavior.
- `frontend/src/config/abis/PolicyManager.json`: `updateSpendingCap` + `SpendingCapUpdated` ABI entries added.
- Removed `useIsContractOwner`, `frontend/.vade-report`, `StatsBar`, and an unused vercel.json entry (dead code cleanup, unrelated to dynamic approval).

### Frontend — checkout gate (`pages/CheckoutPage.tsx`)
- Pulls the payer's active policies via `usePolicies()` and computes a **12-month forward projection** of spend, not remaining cap:
  - Per active sub: `chargeAmount * (SECONDS_PER_YEAR / interval)` where `SECONDS_PER_YEAR = 31_536_000n` (365 days).
  - `projectedAnnualExisting = { total: Σ per-sub annual projection over active capped subs, anyUnlimited: any active sub with cap=0 }`.
  - `projectedAnnualNew = chargeAmount * (year / params.interval)` for the sub being created.
- Skip `wallet_setup` when: allowance is unlimited (`>= UNLIMITED_APPROVAL_THRESHOLD`), OR the user already approved during this checkout (`userApprovedThisFlow`).
- Require unlimited allowance (force step in unless already unlimited) when: Tempo build, OR the new sub is unlimited (`capAmount === null`), OR any existing active sub is unlimited (annual projection is unbounded).
- Otherwise require `allowance >= projectedAnnualExisting.total + projectedAnnualNew`. So a user whose next 12 months of expected charges have outgrown their authorization is routed through `wallet_setup` to top up.

### Frontend — checkout step (`components/checkout/WalletSetupStep.tsx`)
- New props: `chargeAmount`, `capAmount`, `projectedAnnualExisting`, `projectedAnnualNew`, `hasUnlimitedExistingSub?`, `isTempo?`, `onApproved?`.
- Three-mode picker: **Unlimited** (default + recommended), **12 months ($X)**, **Custom**. The 12-month chip shows `projectedAnnualTotal = projectedAnnualExisting + projectedAnnualNew` and is hidden when there's no finite total to project (e.g. new sub is unlimited, or an existing sub is unlimited).
- Approval semantics:
  - **Unlimited** → `setupWallet(undefined)` → unlimited sentinel.
  - **12 months** → absolute approval to `projectedAnnualTotal` (the projection already accounts for existing subs, so it's not additive on top of current `allowance`).
  - **Custom** → absolute to the entered amount; minimum is `chargeAmount`; below-`projectedAnnualNew` shows an amber warning that charges will stop once exhausted.
- Helper copy on the 12-month chip explains the split: existing subs contribute X, new sub contributes Y, total Z.
- When `hasUnlimitedExistingSub` and the user picks any finite mode, an amber line recommends Unlimited (a finite approval can't bound an uncapped existing sub).
- Resolved approval amount:
  - **Match cap** is **additive**: `allowance + capAmount` (so it doesn't clobber commitments from other subscriptions on the same wallet).
  - **Custom** is **absolute**: the user is explicitly setting wallet allowance to the entered number.
  - **Unlimited** → `setupWallet(undefined)` → unlimited sentinel.
- Validation: Custom must be ≥ `chargeAmount`; below-cap Custom shows an amber estimate-of-charges warning (not blocking).
- Tempo branch is hidden — Tempo's relayer-managed wallet always approves max server-side; `onApproved` still fires.
- Footer copy switches between "Approval is capped at X USDC" (finite) and "Subscriptions can charge any amount up to each plan's spending cap and your balance" (unlimited).

### Frontend — dashboard (`components/subscriptions/WalletAllowanceCard.tsx`, new, 309 lines)
- Renders only when ≥ 1 active policy exists.
- Shows: header allowance (Unlimited if `>= UNLIMITED_APPROVAL_THRESHOLD`), lifetime "Total charged via AutoPay", "Committed to active subscriptions" (Σ remaining caps; reads **Unlimited** if any active policy is uncapped).
- **Under-committed** amber banner when `allowanceLoaded && !isApprovalUnlimited && !anyUnlimitedPolicy && allowance < committed`. The `allowanceLoaded` gate avoids a false flag during the initial 0 state.
- Editor (standard wallets only):
  - Currently-unlimited → input is **absolute** (no add/reduce toggle).
  - Currently-finite → **Add / Reduce** toggle; Add → `allowance + delta`, Reduce → `max(0, allowance − delta)` with a guard that rejects `delta > allowance`.
  - **Soft confirm**: if the resulting allowance would drop below committed (and not all policies are unlimited), the first Save shows a warning, the second Save proceeds.
  - "Set unlimited" uses `maxUint256` on standard chains, `maxUint128` on the dev chain (chain id `420420419`).
  - Revoke = `approve(0n)` behind a Confirm.
- Tempo branch: read-only, with copy explaining the wallet manages approval automatically.

### Frontend — per-policy cap editor (`components/subscriptions/SubscriptionDetail.tsx`)
- New optional props `onUpdateCap`, `isUpdatingCap`. When `onUpdateCap` is provided and policy status ≠ `cancelled`, a "Change spending cap" link (or "Raise spending cap to resume" if status is `completed`) opens an inline editor.
- New "Spending cap" rendering: shows **Unlimited** when `spendingCap == 0n`; otherwise amount + progress bar. Active finite-cap policies also show a "Remaining" row.
- Editor validation: finite `newCap` must be `>= totalSpent + chargeAmount` (i.e. room for one more charge), otherwise inline error. "Set unlimited" button sends `0n`. Enter key triggers Save.

### Frontend — page wiring
- `pages/SubscriptionsPage.tsx`: wires `WalletAllowanceCard` into the list view and passes `onUpdateCap` (backed by `useUpdateSpendingCap`) into `SubscriptionDetail`.
- `pages/CheckoutPage.tsx`: passes `chargeAmount`, `capAmount`, `isTempo`, `onApproved` into `WalletSetupStep`.
- `pages/DemoPage.tsx`: minor demo prop updates for the new `WalletSetupStep` signature.
- New untracked file `frontend/src/hooks/useSubscriptionDetailController.ts` and a second wave of UI refactoring are in the working tree but **not yet committed** — this test plan covers what's on the branch tip; the uncommitted slice may shift behavior in `SubscriptionsList` / `WalletAllowanceCard` / `WalletSetupStep` once committed.

### Out-of-scope on this branch
- The market-maker discovery-call doc (`documentation/mm-discovery-call.md`) — unrelated drive-by.

---

## 0. Pre-flight

- [ ] Contracts redeployed from this branch (new `updateSpendingCap` + `SpendingCapUpdated` event)
- [ ] `frontend/src/config/abis/PolicyManager.json` and `relayer/src/abis/ArcPolicyManager.json` both contain `updateSpendingCap` + `SpendingCapUpdated`
- [ ] Relayer running against the redeployed contracts, indexer caught up
- [ ] Frontend pointed at the redeployed contracts
- [ ] Test wallet with ≥ 5 USDC on the configured chain
- [ ] Tempo build available (`isTempoBuild()` true) for the Tempo branch cases
- [ ] At least one test merchant configured in `examples/merchant-checkout/merchant-server/`

---

## 1. Contract: `updateSpendingCap` (PolicyManager.sol)

Run via Foundry or by calling directly from the dashboard cap editor.

| # | Case | Expected |
|---|---|---|
| 1.1 | Non-payer calls `updateSpendingCap` | reverts `NotPolicyOwner` |
| 1.2 | Payer calls on a revoked / inactive policy | reverts `PolicyNotActive` |
| 1.3 | Payer sets `newCap < totalSpent` (finite) | reverts `CapBelowSpent` |
| 1.4 | Payer sets `newCap == totalSpent` | reverts `CapBelowSpent` (strict <) — confirm matches intent |
| 1.5 | Payer raises cap above current | succeeds; `SpendingCapUpdated(policyId, payer, oldCap, newCap)` emitted with correct args |
| 1.6 | Payer lowers cap to a value > `totalSpent` | succeeds; future charges respect the lower cap |
| 1.7 | Payer sets `newCap = 0` (unlimited) | succeeds even when `totalSpent > 0`; policy treated as unlimited going forward |
| 1.8 | Cap-exhausted policy: raise the cap, then trigger a charge | charge succeeds (the existing test in `contracts/test/PolicyManager.t.sol` should pass) |
| 1.9 | Run the new tests | `forge test --match-contract PolicyManager` green |

---

## 2. Relayer indexer + DB sync

For each, watch the relayer logs and the `policies` table.

| # | Case | Expected |
|---|---|---|
| 2.1 | `SpendingCapUpdated` for a policy belonging to a tracked merchant — cap raised | log: "Spending cap updated"; `policies.spending_cap` updated; row stays `active=true` |
| 2.2 | Same as 2.1 but policy is unknown to this relayer (other merchant) | log: "SpendingCapUpdated for unknown policy — skipping"; no DB write |
| 2.3 | Cap-exhausted policy (`active=false`, `cancelled_by_failure=false`) — raise cap to > `total_spent` | log: "Spending cap raised — resuming completed policy"; row flips `active=true`, `ended_at=NULL`, `next_charge_at = last_charged_at + interval` |
| 2.4 | Cap-exhausted policy — set cap to `0` (unlimited) | resumes (same fields as 2.3) |
| 2.5 | Failure-cancelled policy (`cancelled_by_failure=true`) — try to raise on chain | contract rejects (`PolicyNotActive`); no event; no DB change |
| 2.6 | Revoked policy — try to raise | contract rejects; no event |
| 2.7 | Unit tests | `relayer/test/db/policies.test.ts` covers `decideSpendingCapUpdate` — run and confirm green |

---

## 3. Checkout — `WalletSetupStep` approval picker

Open a fresh checkout that requires approval (existing wallet allowance < charge amount). Run once per scenario; reset allowance to 0 between runs where noted.

### 3a. Standard wallet (MetaMask / browser wallet)

| # | Case | Expected |
|---|---|---|
| 3.1 | Plan has a finite cap, no existing subs | three chips visible: **Unlimited recommended**, **12 months ($Y)** where Y = new-sub annual projection, **Custom**; **Unlimited** preselected |
| 3.2 | Plan is unlimited (no cap) | only **Unlimited** and **Custom** chips (12-month hidden because new-sub projection is undefined); **Unlimited** preselected |
| 3.3 | User has existing active capped subs, new sub finite | 12-month chip reads **12 months ($Y_existing + $Y_new = $Y_total)**; helper line splits the contribution; selecting it approves to the absolute $Y_total |
| 3.4 | Any existing active sub is uncapped | 12-month chip hidden; amber line: "One of your existing subscriptions has no cap, so a finite approval can't safely cover it long-term. Unlimited is recommended." |
| 3.5 | Custom: enter amount < `chargeAmount` | inline error: "Must be at least <charge> (one charge), or pick Unlimited"; approval not triggered |
| 3.6 | Custom: enter blank / negative | inline error: "Enter a valid amount" |
| 3.7 | Custom: enter amount ≥ charge but < new-sub annual projection | amber warning: "Below the <projectedNew> projected for the next 12 months of this subscription — charges will stop once this allowance is exhausted." Approval still allowed; tx sets the absolute custom amount |
| 3.8 | Custom: enter amount ≥ projected total | no warning; approve sets the absolute custom amount |
| 3.9 | Unlimited: click approve | approval tx uses unlimited sentinel (`maxUint256`, or `maxUint128` on the dev chain `420420419`) |
| 3.10 | Footer copy: chosen amount is finite | bullet reads "Approval is capped at <amount> USDC — the contract can never pull more" |
| 3.11 | Footer copy: chosen amount is unlimited | bullet reads "Subscriptions can charge any amount up to each plan's spending cap and your balance" |
| 3.12 | After successful approval | `onApproved` fires; checkout advances to the next step |

### 3b. Tempo build

| # | Case | Expected |
|---|---|---|
| 3.12 | Open checkout on Tempo | no picker visible; subheading "Authorize the AutoPay contract to manage your subscriptions"; approval is unlimited server-side |
| 3.13 | Approval completes | `onApproved` fires, advances step |

---

## 4. Dashboard — `WalletAllowanceCard`

Mount the Subscriptions page with ≥ 1 active policy.

### 4a. Display

| # | Case | Expected |
|---|---|---|
| 4.1 | Wallet has 0 active policies | card not rendered |
| 4.2 | Approval ≥ `UNLIMITED_APPROVAL_THRESHOLD` | header shows **Unlimited**; helper copy mentions per-plan cap + balance |
| 4.3 | Approval finite | header shows formatted USDC; helper copy "Approved for the AutoPay contract to charge across all your subscriptions." |
| 4.4 | Some active policy has `spendingCap == 0` | "Committed to active subscriptions" reads **Unlimited** |
| 4.5 | All active policies have finite caps | "Committed" = Σ `(spendingCap − totalSpent)` clipped at 0 per policy |
| 4.6 | `totalSpent > 0` across any policy | "Total charged via AutoPay (lifetime)" row visible |
| 4.7 | Allowance not yet loaded | header shows `—`; no under-committed warning even if `allowance == 0n` |
| 4.8 | Finite allowance < finite committed (allowance loaded, no unlimited policies) | amber AlertTriangle banner: "Your authorization (…) is below the … committed across active subscriptions — some upcoming charges may fail until you increase it." |
| 4.9 | Any active policy is unlimited | no under-committed warning even if allowance < finite-committed sum |

### 4b. Edit / revoke (standard wallet)

| # | Case | Expected |
|---|---|---|
| 4.10 | "Change authorization" → currently unlimited | editor copy: "Your approval is currently **Unlimited**. Scope it…"; input is absolute (no Add/Reduce) |
| 4.11 | "Change authorization" → currently finite | editor copy includes remaining allowance + lifetime charged; Add/Reduce mode toggle visible |
| 4.12 | Add mode: enter delta | preview shows `allowance + delta`; Save approves to that amount |
| 4.13 | Reduce mode: delta ≤ allowance | preview shows `allowance − delta`; Save approves to that amount |
| 4.14 | Reduce mode: delta > allowance | inline error: "Can't reduce by more than the <allowance> remaining authorization" |
| 4.15 | Empty / 0 input | error: "Enter a valid amount" / "Enter an amount greater than zero" |
| 4.16 | Save would drop new allowance below committed (and not all-unlimited) | first Save: amber confirm-again message; second Save: approval proceeds |
| 4.17 | "Set unlimited" button | approve called with `maxUint256` (or `maxUint128` on dev chain `420420419`) |
| 4.18 | Revoke → Confirm | `approve(0n)` tx; on success allowance reads `0` |
| 4.19 | Approval tx rejected by wallet | error surfaces via `approveError`; editor stays open |

### 4c. Tempo build

| # | Case | Expected |
|---|---|---|
| 4.20 | Card on Tempo build | no Change/Revoke buttons; copy: "This wallet manages approval automatically — adjustments aren't available here." |

---

## 5. Subscription detail — per-policy cap editor

Open a subscription via `SubscriptionDetail`.

| # | Case | Expected |
|---|---|---|
| 5.1 | Policy `status === 'cancelled'` | no "Change spending cap" link |
| 5.2 | Active finite-cap policy | "Change spending cap" link visible; clicking shows editor with helper "Set a new lifetime cap, or remove it for unlimited. Raising the cap may prompt a USDC approval." |
| 5.3 | Active unlimited policy (`spendingCap == 0n`) | "Spending cap" row shows **Unlimited**; "Remaining" row hidden; editor still available |
| 5.4 | Completed (cap-exhausted) policy | link reads "Raise spending cap to resume"; helper: "This subscription has reached its cap. Raise the cap to resume charges (or set unlimited)." |
| 5.5 | Save below `totalSpent + chargeAmount` | inline error: "Must be at least <minFiniteCap> USDC (one more charge), or set to unlimited" |
| 5.6 | Save valid finite cap | `updateSpendingCap` tx sent; editor closes on success; UI refreshes (`policy.spendingCap` updated after indexer sync) |
| 5.7 | "Set unlimited" | tx with `newCap = 0n`; on success cap row shows **Unlimited** |
| 5.8 | Tx rejected in wallet | error message surfaces inline; editor stays open |
| 5.9 | Enter-key in input | acts like clicking Save |
| 5.10 | Remaining row | active + finite cap shows `<remaining> of <cap> USDC` and goes to 0 at exhaustion |

---

## 5b. Checkout gate (multi-subscription routing)

Set up: connected wallet has an existing active sub (Sub A) with cap $10, $0 spent → allowance currently $10. Now start checkout for Sub B with cap $0.12.

Setup terminology: `projectedAnnual(p) = p.chargeAmount * (365d / p.interval)`. Example: Sub A = $10/month → annual = $120.

| # | Case | Expected |
|---|---|---|
| 5b.1 | Sub A active ($10/mo, annual projection $120), allowance $50, Sub B = $5/mo (annual $60) | `wallet_setup` shows — required = $120 + $60 = $180, allowance $50 < required |
| 5b.2 | Same as 5b.1 but allowance $200 | `wallet_setup` **skipped** — allowance $200 ≥ $180 |
| 5b.3 | Allowance already unlimited | `wallet_setup` **skipped** |
| 5b.4 | Sub A has `spendingCap = 0` (uncapped), allowance finite | `wallet_setup` shows; only an unlimited approval satisfies the gate (any existing uncapped sub → forced unlimited) |
| 5b.5 | No existing subs, Sub B = $5/mo, allowance 0 | `wallet_setup` shows — required = $60 |
| 5b.6 | Sub B is unlimited (`capAmount === null`), allowance finite | `wallet_setup` shows; only unlimited satisfies the gate |
| 5b.7 | Tempo build, any state with finite allowance | `wallet_setup` shows; only unlimited satisfies |
| 5b.8 | User approves any amount via the step | `onApproved` fires → `userApprovedThisFlow=true`; gate bypassed for the rest of this checkout |
| 5b.9 | User changes cap in ConfirmStep after approving | `userApprovedThisFlow` cleared; gate re-evaluates — may re-route to `wallet_setup` |
| 5b.10 | Default chip selection in `wallet_setup` | **Unlimited** is preselected; 12-month chip shows `$existing_annual + $new_annual` total |
| 5b.11 | Pick 12-month chip and approve | tx sets allowance **absolutely** to the projected total ($180 in 5b.1 scenario); not additive on top of current allowance |

## 6. End-to-end cap flows

| # | Case | Expected |
|---|---|---|
| 6.1 | Subscribe with `Match cap` approval, run enough charges to exhaust cap | last successful charge marks DB row `active=false`; UI status flips to **Completed**; on-chain policy still `active=true` |
| 6.2 | Raise cap from `SubscriptionDetail` on the policy from 6.1 | tx confirms; relayer logs "Spending cap raised — resuming completed policy"; UI flips back to **Active**; next charge fires at `last_charged_at + interval` |
| 6.3 | Lower cap (above totalSpent) on an active policy mid-run | new charges still fire until new cap exhausted; cap-exhaustion path works as in 6.1 |
| 6.4 | Lower wallet allowance via `WalletAllowanceCard` below committed sum, then wait for a charge | charge fails with insufficient-allowance error; under-committed banner persisted |
| 6.5 | Resume from 6.4 by raising allowance back via the card | next scheduled charge succeeds |

---

## 7. Relayer ops — `MERCHANT_ADDRESS` + `/api/plans`

| # | Case | Expected |
|---|---|---|
| 7.1 | Start relayer with no `MERCHANT_ADDRESS` set | clear startup error naming the missing env var |
| 7.2 | Start with `MERCHANT_ADDRESS` containing leading/trailing whitespace | boot succeeds; downstream comparisons use the trimmed value |
| 7.3 | Start with malformed `MERCHANT_ADDRESS` (not a valid address) | startup error with a clear message |
| 7.4 | `POST /api/plans` against an unreachable / 5xx relayer URL | thrown error includes the URL and the upstream response body |
| 7.5 | `POST /api/plans` against a relayer returning a structured error | error message surfaces the relayer's body for debugging |

---

## 8. Regression sweep (existing flows unaffected)

Quick smoke pass — these should look identical to `main`.

- [ ] Create a brand-new subscription (Match cap) end-to-end
- [ ] Create a brand-new subscription (Unlimited) end-to-end
- [ ] Revoke a subscription
- [ ] Run a charge that fails enough times to trip `cancelled_by_failure`; confirm raising cap is impossible (case 2.5)
- [ ] Merchant overview page renders (`StatsBar` removed → `StatsOverview` only)
- [ ] Bridge page still works
- [ ] Sidebar nav unchanged in behavior
- [ ] Existing webhook subscribers still receive the events they did before (no regressions from the indexer changes)

---

## Notes column

| Case | Result | Notes |
|------|--------|-------|
|      |        |       |
