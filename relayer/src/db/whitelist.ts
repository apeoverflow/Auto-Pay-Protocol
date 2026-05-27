import { getDb } from './index.js'

export interface WhitelistEntry {
  address: string
  note: string | null
  created_at: string
}

export async function isWhitelisted(databaseUrl: string, address: string): Promise<boolean> {
  const db = getDb(databaseUrl)
  const rows = await db`
    SELECT 1 FROM whitelist_addresses WHERE address = ${address.toLowerCase()} LIMIT 1
  `
  return rows.length > 0
}

export async function getWhitelist(databaseUrl: string): Promise<WhitelistEntry[]> {
  const db = getDb(databaseUrl)
  return db<WhitelistEntry[]>`
    SELECT * FROM whitelist_addresses ORDER BY created_at DESC
  `
}

export async function addToWhitelist(databaseUrl: string, address: string, note?: string): Promise<WhitelistEntry> {
  const db = getDb(databaseUrl)
  const rows = await db<WhitelistEntry[]>`
    INSERT INTO whitelist_addresses (address, note)
    VALUES (${address.toLowerCase()}, ${note ?? null})
    ON CONFLICT (address) DO UPDATE SET note = COALESCE(${note ?? null}, whitelist_addresses.note)
    RETURNING *
  `
  return rows[0]
}

export async function removeFromWhitelist(databaseUrl: string, address: string): Promise<boolean> {
  const db = getDb(databaseUrl)
  const rows = await db`
    DELETE FROM whitelist_addresses WHERE address = ${address.toLowerCase()} RETURNING address
  `
  return rows.length > 0
}
