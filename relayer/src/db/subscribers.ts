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
  // From payer_contacts (LEFT JOIN — null when no contact row exists yet)
  contact_email: string | null
  email_verified_at: Date | null
  notifications_opted_out: boolean
  notification_stage: number
  low_approval_since: Date | null
  last_allowance_micro: string | null
  last_checked_at: Date | null
  /**
   * Discriminator: true when a payer_contacts row exists for this
   * (chain_id, payer), false when the LEFT JOIN yielded no match.
   * Used by the merchant subscribers endpoint to distinguish "legacy
   * subscriber (predates verify flow)" from "post-verify-flow subscriber
   * who didn't verify" — only the latter should have formData.email
   * redacted for the merchant.
   */
  has_contact_row: boolean
  // From payer_projections
  projected_12mo_micro: string | null
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
    ON CONFLICT (policy_id, chain_id) DO UPDATE SET
      form_data = CASE
        WHEN ${db.json(formData)}::jsonb <> '{}'::jsonb THEN ${db.json(formData)}::jsonb
        ELSE subscriber_data.form_data
      END,
      plan_id = COALESCE(EXCLUDED.plan_id, subscriber_data.plan_id),
      plan_merchant = COALESCE(EXCLUDED.plan_merchant, subscriber_data.plan_merchant)
  `

  logger.debug({ policyId, chainId, payer }, 'Inserted subscriber data')
}

export async function getSubscribersByMerchant(
  databaseUrl: string,
  merchant: string,
  opts: {
    chainId?: number
    planId?: string
    /** When true, restrict to rows currently in low-approval state (notification_stage > 0). */
    onlyAtRisk?: boolean
    page?: number
    limit?: number
  } = {}
): Promise<{ subscribers: SubscriberWithPolicy[]; total: number }> {
  const db = getDb(databaseUrl)
  const addr = merchant.toLowerCase()
  const page = opts.page ?? 1
  const limit = opts.limit ?? 50
  const offset = (page - 1) * limit

  // Build filters conditionally — omitted filters collapse to empty fragments.
  const chainFilter = opts.chainId != null ? db`AND s.chain_id = ${opts.chainId}` : db``
  const planFilter = opts.planId ? db`AND s.plan_id = ${opts.planId}` : db``
  const atRiskFilter = opts.onlyAtRisk ? db`AND COALESCE(pc.notification_stage, 0) > 0` : db``

  const [subscribers, countResult] = await Promise.all([
    db<SubscriberWithPolicy[]>`
      SELECT
        s.policy_id, s.chain_id, s.payer, s.plan_id, s.form_data,
        COALESCE(p.active, false) AS active,
        COALESCE(p.charge_amount, '0') AS charge_amount,
        COALESCE(p.interval_seconds, 0) AS interval_seconds,
        s.created_at,
        pc.email AS contact_email,
        pc.email_verified_at,
        (pc.payer IS NOT NULL) AS has_contact_row,
        COALESCE(pc.notifications_opted_out, false) AS notifications_opted_out,
        COALESCE(pc.notification_stage, 0) AS notification_stage,
        pc.low_approval_since,
        pc.last_allowance_micro::TEXT AS last_allowance_micro,
        pc.last_checked_at,
        pp.projected_12mo_micro::TEXT AS projected_12mo_micro
      FROM subscriber_data s
      LEFT JOIN policies p          ON s.policy_id = p.id AND s.chain_id = p.chain_id
      LEFT JOIN payer_contacts pc   ON pc.chain_id = s.chain_id AND pc.payer = s.payer
      LEFT JOIN payer_projections pp ON pp.chain_id = s.chain_id AND pp.payer = s.payer
      WHERE s.merchant = ${addr} ${chainFilter} ${planFilter} ${atRiskFilter}
      ORDER BY s.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    db`
      SELECT count(*)::int AS total
      FROM subscriber_data s
      LEFT JOIN payer_contacts pc ON pc.chain_id = s.chain_id AND pc.payer = s.payer
      WHERE s.merchant = ${addr} ${chainFilter} ${planFilter} ${atRiskFilter}
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
