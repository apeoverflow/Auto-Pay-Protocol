/**
 * Register a merchant's webhook URL with the AutoPay relayer
 *
 * Usage:
 *   node register-merchant.js <merchant-address> <webhook-url> <webhook-secret>
 *
 * Example:
 *   node register-merchant.js 0x1234... http://localhost:3500/webhook my-secret-key
 */

import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required')
  console.error('Run: export DATABASE_URL=<your-supabase-url>')
  process.exit(1)
}

const [, , merchantAddress, webhookUrl, webhookSecret] = process.argv

if (!merchantAddress || !webhookUrl || !webhookSecret) {
  console.log(`
Usage: node register-merchant.js <merchant-address> <webhook-url> <webhook-secret>

Example:
  node register-merchant.js 0x2B8b9182c1c3A9bEf4a60951D9B7F49420D12B9B http://localhost:3500/webhook my-secret-123
  `)
  process.exit(1)
}

const sql = postgres(DATABASE_URL)

async function registerMerchant() {
  console.log('\nRegistering merchant webhook...')
  console.log(`  Address: ${merchantAddress}`)
  console.log(`  URL: ${webhookUrl}`)
  console.log(`  Secret: ${webhookSecret.slice(0, 4)}...`)

  await sql`
    INSERT INTO merchants (address, webhook_url, webhook_secret)
    VALUES (${merchantAddress.toLowerCase()}, ${webhookUrl}, ${webhookSecret})
    ON CONFLICT (address) DO UPDATE
    SET webhook_url = ${webhookUrl}, webhook_secret = ${webhookSecret}
  `

  console.log('\n✅ Merchant registered successfully!')
  console.log('\nThe relayer will now send webhooks to your endpoint when:')
  console.log('  - Charges succeed or fail for policies with this merchant')
  console.log('  - Policies are created or revoked for this merchant')

  await sql.end()
}

registerMerchant().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
