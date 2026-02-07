/**
 * Example: Build a checkout URL for your subscription plan
 *
 * Run: npx tsx examples/checkout-url.ts
 */
import { createCheckoutUrl, intervals, parseUSDC, calculateFeeBreakdown } from '../src'

// Build the checkout URL
const url = createCheckoutUrl({
  merchant: '0x2B8b9182c1c3A9bEf4a60951D9B7F49420D12B9B',
  amount: 9.99,
  interval: 'monthly',
  metadataUrl: 'https://mysite.com/plans/pro.json',
  successUrl: 'https://mysite.com/success',
  cancelUrl: 'https://mysite.com/cancel',
  spendingCap: 119.88, // 12 months worth
})

console.log('Checkout URL:')
console.log(url)
console.log()

// Show fee breakdown
const rawAmount = parseUSDC(9.99)
const fees = calculateFeeBreakdown(rawAmount)
console.log('Fee breakdown:')
console.log(`  Total charge:      $${fees.total}`)
console.log(`  Merchant receives: $${fees.merchantReceives}`)
console.log(`  Protocol fee:      $${fees.protocolFee} (${fees.feePercentage})`)
console.log()

// Custom interval example
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
