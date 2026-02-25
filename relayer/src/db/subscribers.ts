import { getDb } from './index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('db:subscribers')

export interface SubscriberDataRow {
  id: number
  policy_id: string
  chain_id: number
  payer: string
  merchant: string
  plan_id: string | null
  plan_merchant: string | null
  form_data: Record<string, string>
  created_at: Date
}

export interface SubscriberWithPolicy {
  policy_id: string
  chain_id: number
  payer: string
  plan_id: string | null
  form_data: Record<string, string>
  active: boolean
  charge_amount: string
  interval_seconds: number
  created_at: Date
}

export async function insertSubscriberData(
  databaseUrl: string,
  policyId: string,
  chainId: number,
  payer: string,
  merchant: string,
  planId: string | null,
  planMerchant: string | null,
  formData: Record<string, string>
): Promise<void> {
  const db = getDb(databaseUrl)

  await db`
    INSERT INTO subscriber_data (policy_id, chain_id, payer, merchant, plan_id, plan_merchant, form_data)
    VALUES (${policyId}, ${chainId}, ${payer.toLowerCase()}, ${merchant.toLowerCase()}, ${planId}, ${planMerchant?.toLowerCase() ?? null}, ${db.json(formData)})
    ON CONFLICT (policy_id, chain_id) DO NOTHING
  `

  logger.debug({ policyId, chainId, payer }, 'Inserted subscriber data')
}

export async function getSubscribersByMerchant(
  databaseUrl: string,
  merchant: string,
  chainId: number,
  planId?: string,
  page = 1,
  limit = 50
): Promise<{ subscribers: SubscriberWithPolicy[]; total: number }> {
  const db = getDb(databaseUrl)
  const addr = merchant.toLowerCase()
  const offset = (page - 1) * limit

  const selectFields = `
    s.policy_id, s.chain_id, s.payer, s.plan_id, s.form_data,
    COALESCE(p.active, false) AS active,
    COALESCE(p.charge_amount, '0') AS charge_amount,
    COALESCE(p.interval_seconds, 0) AS interval_seconds,
    s.created_at`

  const [subscribers, countResult] = planId
    ? await Promise.all([
        db<SubscriberWithPolicy[]>`
          SELECT ${db.unsafe(selectFields)}
          FROM subscriber_data s
          LEFT JOIN policies p ON s.policy_id = p.id AND s.chain_id = p.chain_id
          WHERE s.merchant = ${addr} AND s.chain_id = ${chainId} AND s.plan_id = ${planId}
          ORDER BY s.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        db`
          SELECT count(*)::int AS total
          FROM subscriber_data s
          WHERE s.merchant = ${addr} AND s.chain_id = ${chainId} AND s.plan_id = ${planId}
        `,
      ])
    : await Promise.all([
        db<SubscriberWithPolicy[]>`
          SELECT ${db.unsafe(selectFields)}
          FROM subscriber_data s
          LEFT JOIN policies p ON s.policy_id = p.id AND s.chain_id = p.chain_id
          WHERE s.merchant = ${addr} AND s.chain_id = ${chainId}
          ORDER BY s.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        db`
          SELECT count(*)::int AS total
          FROM subscriber_data s
          WHERE s.merchant = ${addr} AND s.chain_id = ${chainId}
        `,
      ])

  return { subscribers, total: countResult[0]?.total ?? 0 }
}

export async function getSubscriberByPolicy(
  databaseUrl: string,
  policyId: string,
  chainId: number
): Promise<SubscriberDataRow | null> {
  const db = getDb(databaseUrl)

  const rows = await db<SubscriberDataRow[]>`
    SELECT * FROM subscriber_data
    WHERE policy_id = ${policyId} AND chain_id = ${chainId}
  `

  return rows[0] ?? null
}
