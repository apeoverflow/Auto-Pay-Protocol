import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:payments')

export interface PaymentRow {
  id: number
  chain_id: number
  from_address: string
  to_address: string
  amount: string
  tx_hash: string
  block_number: number | null
  note: string | null
  created_at: Date
}

export async function insertPayment(
  databaseUrl: string,
  chainId: number,
  from: string,
  to: string,
  amount: string,
  txHash: string,
  blockNumber?: number,
  note?: string
): Promise<number> {
  const db = getDb(databaseUrl)
  const result = await db`
    INSERT INTO payments (chain_id, from_address, to_address, amount, tx_hash, block_number, note)
    VALUES (${chainId}, ${from.toLowerCase()}, ${to.toLowerCase()}, ${amount}, ${txHash.toLowerCase()}, ${blockNumber ?? null}, ${note ?? null})
    ON CONFLICT (tx_hash) DO NOTHING
    RETURNING id
  `
  if (result.length > 0) {
    logger.debug({ txHash, from, to, amount }, 'Payment recorded')
    return result[0].id
  }
  return 0 // duplicate
}

export async function getPaymentsByAddress(
  databaseUrl: string,
  address: string,
  limit = 50,
  offset = 0
): Promise<{ payments: PaymentRow[]; total: number }> {
  const db = getDb(databaseUrl)
  const addr = address.toLowerCase()

  const payments = await db`
    SELECT * FROM payments
    WHERE from_address = ${addr} OR to_address = ${addr}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  const countRows = await db`
    SELECT COUNT(*) as cnt FROM payments
    WHERE from_address = ${addr} OR to_address = ${addr}
  `

  return {
    payments: payments as unknown as PaymentRow[],
    total: Number(countRows[0].cnt),
  }
}
