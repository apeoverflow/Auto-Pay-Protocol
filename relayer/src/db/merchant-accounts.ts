import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:merchant-accounts')

export interface MerchantAccount {
  address: string
  email: string
  supabase_user_id: string | null
  verified_at: string
  created_at: string
}

export async function getMerchantAccount(
  databaseUrl: string,
  address: string
): Promise<MerchantAccount | null> {
  const db = getDb(databaseUrl)

  const rows = await db<MerchantAccount[]>`
    SELECT * FROM merchant_accounts
    WHERE address = ${address.toLowerCase()}
  `

  return rows[0] ?? null
}

export async function createMerchantAccount(
  databaseUrl: string,
  address: string,
  email: string,
  supabaseUserId?: string
): Promise<MerchantAccount> {
  const db = getDb(databaseUrl)

  const rows = await db<MerchantAccount[]>`
    INSERT INTO merchant_accounts (address, email, supabase_user_id)
    VALUES (${address.toLowerCase()}, ${email.toLowerCase()}, ${supabaseUserId ?? null})
    ON CONFLICT (address) DO UPDATE
    SET email = ${email.toLowerCase()}, supabase_user_id = COALESCE(${supabaseUserId ?? null}, merchant_accounts.supabase_user_id)
    RETURNING *
  `

  logger.info({ address, email }, 'Merchant account created/updated')
  return rows[0]
}
