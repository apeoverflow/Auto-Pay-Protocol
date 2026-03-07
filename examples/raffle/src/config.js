/**
 * Raffle configuration — all values overridable via env vars.
 */

import { CHAINS } from './chains.js'

const CHAIN_NAME = process.env.CHAIN || 'baseSepolia'
const chain = CHAINS[CHAIN_NAME]
if (!chain) {
  console.error(`Unknown chain: ${CHAIN_NAME}. Use: ${Object.keys(CHAINS).join(', ')}`)
  process.exit(1)
}

export const config = {
  // Server
  port: Number(process.env.PORT) || 4100,
  webhookSecret: process.env.WEBHOOK_SECRET || '',

  // Chain
  chainName: CHAIN_NAME,
  chain,

  // Raffle settings
  merchantAddress: process.env.MERCHANT_ADDRESS || '0x2B8b9182c1c3A9bEf4a60951D9B7F49420D12B9B',
  entryFee: process.env.ENTRY_FEE || '1',

  // Checkout URL — generated from merchant dashboard (includes plan, fields, success/cancel URLs)
  checkoutUrl: process.env.CHECKOUT_URL || 'https://autopayprotocol.com/checkout?merchant=0x2B8b9182c1c3A9bEf4a60951D9B7F49420D12B9B&metadata_url=https%3A%2F%2Fautopay-relayer-production.up.railway.app%2Fmetadata%2F0x2b8b9182c1c3a9bef4a60951d9b7f49420d12b9b%2Fautoraffle-q4u5x&amount=1&interval=604800&spending_cap=12&ipfs_metadata_url=https%3A%2F%2Fw3s.link%2Fipfs%2Fbafkreiblljd4axe4zmpmfbykr7yscoqq3rpppxxst5jmrnfkpkfcf4icva&success_url=https%3A%2F%2Fautopayprotocol.com%2Fdashboard&cancel_url=https%3A%2F%2Fautopayprotocol.com%2Fdashboard&fields=name:r,email:r',
}
