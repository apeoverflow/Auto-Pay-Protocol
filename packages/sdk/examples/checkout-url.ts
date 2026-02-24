/**
 * Build checkout URLs for your subscription plans.
 *
 * Run: npx tsx examples/checkout-url.ts
 */
import {
  createCheckoutUrl,
  createCheckoutUrlFromPlan,
  intervals,
  parseUSDC,
  calculateFeeBreakdown,
  chains,
} from '@autopayprotocol/sdk'

// --- Option A: Build a checkout URL directly ---
// Use this when you know the billing params and host your own metadata JSON.

const url = createCheckoutUrl({
  merchant: '0x2B8b9182c1c3A9bEf4a60951D9B7F49420D12B9B',
  amount: 9.99,
  interval: 'monthly',
  metadataUrl: 'https://mysite.com/plans/pro.json',
  successUrl: 'https://mysite.com/success',
  cancelUrl: 'https://mysite.com/cancel',
  spendingCap: 119.88, // 12 months worth
})

console.log('Direct checkout URL:')
console.log(url)
console.log()

// --- Option B: Build from a relayer-hosted plan ---
// Use this when your plans are managed via the relayer dashboard.
// The SDK fetches billing params + IPFS metadata URL automatically.

const planUrl = await createCheckoutUrlFromPlan({
  relayerUrl: 'https://autopay-relayer-production.up.railway.app',
  merchant: '0x2B8b9182c1c3A9bEf4a60951D9B7F49420D12B9B',
  planId: 'pro-plan-5av1m',
  successUrl: 'https://mysite.com/success',
  cancelUrl: 'https://mysite.com/cancel',
})

console.log('Plan-based checkout URL:')
console.log(planUrl)
console.log()

// --- Targeting a specific chain ---
// By default, checkout URLs point to the Base deployment (autopayprotocol.com).
// To target Flow EVM, pass the chain's checkoutBaseUrl:

const flowUrl = createCheckoutUrl({
  merchant: '0x2B8b9182c1c3A9bEf4a60951D9B7F49420D12B9B',
  amount: 4.99,
  interval: 'weekly',
  metadataUrl: 'https://mysite.com/plans/basic.json',
  successUrl: 'https://mysite.com/success',
  cancelUrl: 'https://mysite.com/cancel',
  baseUrl: chains.flowEvm.checkoutBaseUrl,
})

console.log('Flow EVM checkout URL:')
console.log(flowUrl)
console.log()

// --- Custom intervals ---

const biweeklyUrl = createCheckoutUrl({
  merchant: '0x2B8b9182c1c3A9bEf4a60951D9B7F49420D12B9B',
  amount: 4.99,
  interval: intervals.custom(14, 'days'),
  metadataUrl: 'https://mysite.com/plans/basic.json',
  successUrl: 'https://mysite.com/success',
  cancelUrl: 'https://mysite.com/cancel',
})

console.log('Biweekly checkout URL:')
console.log(biweeklyUrl)
console.log()

// --- Fee breakdown ---

const rawAmount = parseUSDC(9.99)
const fees = calculateFeeBreakdown(rawAmount)
console.log('Fee breakdown for $9.99/month:')
console.log(`  Total charge:      $${fees.total}`)
console.log(`  Merchant receives: $${fees.merchantReceives}`)
console.log(`  Protocol fee:      $${fees.protocolFee} (${fees.feePercentage})`)
