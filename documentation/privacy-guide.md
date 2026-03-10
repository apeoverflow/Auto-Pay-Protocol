# Privacy Guide — Merchant ↔ Customer Unlinkability

## The Problem

By default, every `PolicyCreated` and `ChargeSucceeded` event on-chain contains:

```
PolicyCreated(policyId, payer, merchant, chargeAmount, interval, ...)
ChargeSucceeded(policyId, payer, merchant, amount, protocolFee)
```

Anyone can query these events and build a complete graph of which customers
subscribe to which merchants — their subscription amounts, frequency, and
payment history. For many businesses this is a serious competitive and privacy
concern.

## Solution Overview

AutoPay's privacy layer uses **two composable third-party primitives** so you
don't need to build privacy tech yourself:

| Layer | Technology | What it hides | Effort |
|-------|-----------|---------------|--------|
| **Stealth Addresses** | [Umbra / ERC-5564](https://github.com/ScopeLift/umbra-protocol) | Merchant identity | Low — just register keys |
| **Shielded Payments** | [RAILGUN](https://docs.railgun.org/developer-guide) | Payer identity + amounts | Medium — customer uses RAILGUN wallet |

Used together, they fully break the on-chain link between payer and merchant.

```
                                  ON-CHAIN VIEW
                                  ────────────
Before privacy:    alice.eth  ──→  netflix-merchant.eth    ($9.99/mo)
                   bob.eth   ──→  netflix-merchant.eth    ($14.99/mo)

After privacy:     0x7a3f...  ──→  0xc9d2...  ($9.99/mo)    ← stealth addr
                   0xb1e8...  ──→  0x4f7a...  ($14.99/mo)   ← different stealth addr
                   (shielded)      (unlinkable to merchant)
```

---

## Layer 1: Stealth Addresses (Merchant Privacy)

### How It Works

1. **Merchant registers** a stealth meta-address (two public keys: spending + viewing)
2. **Customer's wallet** generates a random ephemeral key pair
3. Using ECDH, the customer derives a **one-time stealth address** that only the
   merchant can spend from
4. The subscription policy is created with this stealth address as the "merchant"
5. An **ERC-5564 Announcement** event is emitted with the ephemeral public key
   and a view tag
6. The merchant's **scanner** checks each Announcement using their viewing key
   — if the view tag matches, they derive the full spending key

### On-Chain Result

- The `PolicyManager` stores `merchant = 0xc9d2...` (stealth address)
- There is **no on-chain link** between `0xc9d2...` and the real merchant
- Each subscription uses a **different** stealth address
- Only the merchant (with their viewing key) can discover which stealth
  addresses belong to them

### Integration: Umbra Protocol

[Umbra](https://app.umbra.cash/) is the leading stealth address implementation
on EVM chains. It implements ERC-5564 and ERC-6538 and has processed $250M+ in
private payments.

**npm package:** `@umbracash/umbra-js`

```typescript
import { Umbra, KeyPair } from '@umbracash/umbra-js';

// ── Merchant: One-time setup ──
// Sign a message to derive spending + viewing keys
const umbra = new Umbra(provider, chainId);
await umbra.setStealthKeys(signer); // Registers keys on-chain (ERC-6538)

// ── Customer: Creating a private subscription ──
// Generate stealth address for the merchant
const { stealthAddress, ephemeralPublicKey, viewTag } =
  await umbra.generateStealthAddress(merchantAddress);

// Create policy via PrivacyRouter (not PolicyManager directly)
const tx = await privacyRouter.createPrivatePolicy(
  merchantAddress,     // real merchant (looked up in registry, NOT stored on-chain)
  chargeAmount,
  interval,
  spendingCap,
  metadataUrl,
  stealthAddress,      // this is what goes on-chain as "merchant"
  ephemeralPublicKey.x,
  ephemeralPublicKey.y,
  viewTag
);

// ── Merchant: Scanning for payments ──
// The merchant periodically scans Announcement events
const announcements = await umbra.scan(viewingPrivateKey);
// Each match gives them the stealth address + spending key
for (const { stealthAddress, spendingKey } of announcements) {
  // Withdraw USDC from stealth address to their real wallet
  const wallet = new Wallet(spendingKey, provider);
  await usdc.connect(wallet).transfer(merchantRealAddress, balance);
}
```

### Contract: `PrivacyRouter.sol`

The `PrivacyRouter` wraps `PolicyManager` to add stealth address support:

```
contracts/src/privacy/PrivacyRouter.sol
```

Key function:

```solidity
function createPrivatePolicy(
    address merchant,           // Real merchant (for registry lookup only)
    uint128 chargeAmount,
    uint32 interval,
    uint128 spendingCap,
    string calldata metadataUrl,
    address stealthAddress,     // One-time address → goes into PolicyManager
    uint256 ephemeralPubKeyX,   // For the Announcement event
    uint256 ephemeralPubKeyY,
    bytes1 viewTag              // Fast scanning filter
) external returns (bytes32 policyId);
```

---

## Layer 2: RAILGUN Shielded Payments (Payer Privacy)

### How It Works

[RAILGUN](https://www.railgun.org/) lets users shield ERC-20 tokens into a
private pool using ZK-SNARKs. Once shielded, transfers and DeFi interactions
happen privately — no one can see who sent what to whom.

1. **Customer shields USDC** into RAILGUN (public → private 0zk balance)
2. **Customer uses a RAILGUN cross-contract call** to interact with AutoPay's
   `PrivacyRouter` from their shielded balance
3. The on-chain transaction shows RAILGUN's Relay Adapt contract as the caller
   — **not the customer's real wallet**
4. Combined with stealth addresses, both sides of the payment are private

### Integration

RAILGUN provides SDKs for building this into your dApp:

- **Wallet SDK:** `@railgun-community/wallet`
- **Engine:** `@railgun-community/engine`
- **Cookbook:** Pre-built recipes for cross-contract calls

```typescript
import { shieldERC20, crossContractCall } from '@railgun-community/wallet';

// 1. Shield USDC into RAILGUN private balance
await shieldERC20({
  token: USDC_ADDRESS,
  amount: '100000000', // 100 USDC
  wallet: railgunWallet,
});

// 2. Create private subscription via cross-contract call
//    RAILGUN unshields → calls PrivacyRouter → re-shields change
await crossContractCall({
  wallet: railgunWallet,
  calls: [{
    to: PRIVACY_ROUTER_ADDRESS,
    data: privacyRouter.interface.encodeFunctionData('createPrivatePolicy', [
      merchantAddress, chargeAmount, interval, spendingCap, metadataUrl,
      stealthAddress, ephemeralPubKeyX, ephemeralPubKeyY, viewTag
    ]),
    value: 0n,
  }],
  tokens: [{ token: USDC_ADDRESS, amount: chargeAmount }],
});
```

### Considerations

- RAILGUN is deployed on **Ethereum, Base, Arbitrum, BSC, and Polygon**
- The customer needs a RAILGUN-compatible wallet (Railway Wallet, or integrate
  via the SDK)
- Cross-contract calls cost more gas due to ZK proof generation
- This is **optional** — stealth addresses alone provide merchant privacy

---

## Privacy Matrix

| Scenario | Merchant hidden? | Payer hidden? | Amount hidden? |
|----------|:---:|:---:|:---:|
| Plain PolicyManager | No | No | No |
| PrivacyRouter + Stealth Addresses | **Yes** | No | No |
| PrivacyRouter + Stealth + RAILGUN | **Yes** | **Yes** | **Yes** |

---

## Relayer Considerations

When privacy mode is enabled, the relayer needs adjustments:

### Scanning for Stealth Policies

The relayer should index `Announcement` events from `PrivacyRouter` alongside
`PolicyCreated` events from `PolicyManager`. The merchant provides their
viewing key to the relayer (or a dedicated scanning service) so it can:

1. Filter Announcements by `viewTag` (6x faster than checking every event)
2. Derive the shared secret and verify the stealth address matches
3. Map stealth addresses back to real merchants internally

### Charging Stealth Policies

Charging works identically — the relayer calls `PolicyManager.charge(policyId)`
as usual. The USDC goes to the stealth address. The merchant's scanner
discovers the payment and sweeps funds to their real wallet.

### Webhook Delivery

Webhooks still work. The relayer internally maps stealth addresses to real
merchants (via Announcement scanning) and delivers webhooks to the correct
merchant endpoint.

---

## Getting Started

### For Merchants

1. **Install Umbra JS:** `npm install @umbracash/umbra-js`
2. **Register stealth keys** on the ERC-6538 registry (one-time tx)
3. **Set up a scanner** to monitor Announcement events (or use Umbra's hosted
   scanner)
4. **Sweep funds** from stealth addresses to your main wallet periodically

### For the Frontend

1. When a merchant has stealth keys registered, the checkout flow uses
   `PrivacyRouter.createPrivatePolicy()` instead of `PolicyManager.createPolicy()`
2. The customer's wallet generates the ephemeral key pair and stealth address
   using `@umbracash/umbra-js`
3. The UI can optionally prompt the customer to shield USDC via RAILGUN first

---

## Third-Party Resources

- **Umbra Protocol:** https://github.com/ScopeLift/umbra-protocol
- **Umbra JS SDK:** https://www.npmjs.com/package/@umbracash/umbra-js
- **ERC-5564 (Stealth Addresses):** https://eips.ethereum.org/EIPS/eip-5564
- **ERC-6538 (Stealth Meta-Address Registry):** https://eips.ethereum.org/EIPS/eip-6538
- **RAILGUN Developer Guide:** https://docs.railgun.org/developer-guide
- **RAILGUN Wallet SDK:** https://github.com/Railgun-Community/wallet
- **RAILGUN Cookbook:** https://docs.railgun.org/developer-guide/wallet/transactions/cross-contract-calls
