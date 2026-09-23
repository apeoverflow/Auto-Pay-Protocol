import { parseAbi } from 'viem'
import type { ChainConfig, RelayerConfig, WebhookPayload } from '../types.js'
import { getDb } from '../db/index.js'
import { getPublicClient } from '../lib/clients.js'
import { enqueueEmail, enqueueEmailWithSql } from '../db/email-outbox.js'
import { queueWebhook } from '../db/webhooks.js'
import { decide, type MonitorConfig, type MonitorObservation, type MonitorState } from './state.js'
import { createLogger } from '../utils/logger.js'
import { sleep } from '../utils/sleep.js'

const logger = createLogger('approval-monitor')

const ERC20_ALLOWANCE_ABI = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
])

const MULTICALL_CHUNK = 100

interface Candidate {
  chainId: number
  payer: `0x${string}`
  email: string
  optOutToken: string
  notificationStage: number
  lowApprovalSince: Date | null
  nextNotificationAt: Date | null
  projected12moMicro: bigint
  activePolicyCount: number
  // Read from DB and passed through to decide() so the state machine sees
  // real values (rather than relying on the SELECT filter to always match
  // its assumptions). Belt-and-braces: if the SELECT is ever relaxed, the
  // state machine short-circuits correctly instead of silently misfiring.
  notificationsOptedOut: boolean
  emailVerified: boolean
}

interface AffectedPolicy {
  id: string
  merchant: string
  chargeAmountMicro: bigint
  intervalSeconds: number
  planId: string | null
  planMerchant: string | null
}

export interface MonitorTickResult {
  candidates: number
  notified: number
  reset: number
  skipped: number
  errors: number
}

/**
 * One monitor tick, scoped to a single chain.
 *
 * Concurrency model:
 *   • Multiple relayer replicas may run this simultaneously against the
 *     same DB. Safety comes from two mechanisms:
 *
 *       1. `email_outbox.dedupe_key = 'low:<chainId>:<payer>:<newStage>'`
 *          is UNIQUE. Two replicas computing the same next email for the
 *          same (payer, stage) will result in exactly one enqueued row.
 *
 *       2. The `payer_contacts` update is CAS-guarded on the observed
 *          `notification_stage` — if another replica advanced first, our
 *          UPDATE affects zero rows and we skip the webhook emission.
 *          The winning replica does the enqueue and the webhook.
 *
 *   • No advisory locks / no `FOR UPDATE SKIP LOCKED` — postgres.js pools
 *     connections, which makes session-scoped locks unreliable. The CAS +
 *     dedupe pair is strictly sufficient.
 */
export async function runApprovalMonitorOnce(
  config: RelayerConfig,
  chainConfig: ChainConfig
): Promise<MonitorTickResult> {
  const db = getDb(config.databaseUrl)
  const monitorCfg: MonitorConfig = {
    thresholdBps: config.approvalMonitor.thresholdBps,
    backoffDays: config.approvalMonitor.backoffDays,
  }

  // 1. Pick eligible + due candidates on this chain. The
  //    `idx_payer_contacts_notifiable` partial index means the sort is a
  //    trivial range scan even with millions of rows.
  const rows = await db<Array<{
    chain_id: number; payer: string; email: string; opt_out_token: string
    notification_stage: number
    low_approval_since: Date | null; next_notification_at: Date | null
    projected_12mo_micro: string; active_policy_count: number
    notifications_opted_out: boolean; email_verified: boolean
  }>>`
    SELECT pc.chain_id, pc.payer, pc.email, pc.opt_out_token,
           pc.notification_stage, pc.low_approval_since, pc.next_notification_at,
           pp.projected_12mo_micro::TEXT AS projected_12mo_micro,
           pp.active_policy_count,
           pc.notifications_opted_out,
           (pc.email_verified_at IS NOT NULL) AS email_verified
    FROM payer_contacts pc
    JOIN payer_projections pp USING (chain_id, payer)
    WHERE pc.chain_id = ${chainConfig.chainId}
      AND pc.email IS NOT NULL
      AND pc.email_verified_at IS NOT NULL
      AND NOT pc.notifications_opted_out
      AND pp.active_policy_count > 0
      AND pp.projected_12mo_micro > 0
      AND (pc.next_notification_at IS NULL OR pc.next_notification_at <= NOW())
    ORDER BY pc.next_notification_at NULLS FIRST
    LIMIT ${config.approvalMonitor.batchSize}
  `

  if (rows.length === 0) {
    return { candidates: 0, notified: 0, reset: 0, skipped: 0, errors: 0 }
  }

  const candidates: Candidate[] = rows.map((r) => ({
    chainId: r.chain_id,
    payer: r.payer as `0x${string}`,
    email: r.email,
    optOutToken: r.opt_out_token,
    notificationStage: r.notification_stage,
    lowApprovalSince: r.low_approval_since,
    nextNotificationAt: r.next_notification_at,
    projected12moMicro: BigInt(r.projected_12mo_micro),
    activePolicyCount: r.active_policy_count,
    notificationsOptedOut: r.notifications_opted_out,
    emailVerified: r.email_verified,
  }))

  // 2. Multicall allowance(payer, PolicyManager) — one JSON-RPC call per
  //    chunk of up to 100. `allowFailure` lets us drop unreadable rows
  //    rather than blowing up the whole tick.
  const client = getPublicClient(chainConfig)
  const allowances = new Map<string, bigint>()
  let rpcErrors = 0

  for (let i = 0; i < candidates.length; i += MULTICALL_CHUNK) {
    const chunk = candidates.slice(i, i + MULTICALL_CHUNK)
    try {
      const results = await client.multicall({
        allowFailure: true,
        contracts: chunk.map((c) => ({
          address: chainConfig.usdcAddress,
          abi: ERC20_ALLOWANCE_ABI,
          functionName: 'allowance',
          args: [c.payer, chainConfig.policyManagerAddress],
        })),
      })
      for (let j = 0; j < chunk.length; j++) {
        const r = results[j]
        if (r.status === 'success') {
          allowances.set(chunk[j].payer, r.result as bigint)
        } else {
          rpcErrors++
          logger.warn({ payer: chunk[j].payer, err: r.error }, 'Allowance read failed')
        }
      }
    } catch (err) {
      // Whole batch failed — count and continue with the rest.
      rpcErrors += chunk.length
      logger.error({ chainId: chainConfig.chainId, chunkSize: chunk.length, err }, 'Multicall batch failed')
    }
  }

  // 3. Apply the state machine per candidate. Each candidate is
  //    independent so we handle failures locally.
  const now = new Date()
  let notified = 0
  let reset = 0
  let skipped = 0

  for (const c of candidates) {
    const allowance = allowances.get(c.payer)
    if (allowance === undefined) {
      skipped++
      continue
    }

    // Pass REAL state through — no hardcoded assumptions about what the
    // SELECT filtered. If the SELECT is later relaxed (e.g. surface stage-0
    // healthy payers for telemetry), the state machine will short-circuit
    // correctly rather than silently misfire.
    const state: MonitorState = {
      notificationStage: c.notificationStage,
      notificationsOptedOut: c.notificationsOptedOut,
      lowApprovalSince: c.lowApprovalSince,
      nextNotificationAt: c.nextNotificationAt,
      emailVerified: c.emailVerified,
    }
    const observed: MonitorObservation = {
      currentAllowanceMicro: allowance,
      projected12moMicro: c.projected12moMicro,
    }

    try {
      const action = decide(state, observed, monitorCfg, now)

      if (action.kind === 'notify') {
        // TRANSACTIONAL CAS + ENQUEUE.
        //
        // Both operations run inside a single sql.begin block so:
        //   • The episode-scoped dedupe key uses the DB-authoritative
        //     `low_approval_since` value (COALESCE-set on first detection
        //     in the UPDATE itself, then RETURNING'd). Two replicas
        //     racing first-detection SEE THE SAME TIMESTAMP because the
        //     row-level lock serialises the UPDATEs. Winning replica sets
        //     T; losing replica's CAS fails on notification_stage predicate
        //     and rolls back. No client-time drift, no duplicate emails.
        //   • If enqueue throws (transient DB error), the transaction
        //     rolls back — the CAS is undone, next tick retries the same
        //     state. No "stage advanced, email lost" bug.
        const policies = await getActivePolicies(config, chainConfig.chainId, c.payer)

        const result = await notifyTransaction(config, chainConfig, c, action.priorStage,
          action.newStage, action.nextNotificationAt, action.thresholdMicro, allowance, now, policies)
        if (!result.won) { skipped++; continue }

        // Webhook is only queued when WE won the CAS. Pass
        // action.lowApprovalSince (guaranteed non-null via `?? now` in
        // decide()) so first-detection stage-1 events include a valid
        // timestamp — c.lowApprovalSince from the SELECT snapshot is
        // still null at this point even though notifyTransaction just
        // COALESCE-seeded the DB value.
        await queueSubscriberWebhooks(config, chainConfig.chainId, c, policies,
          'subscriber.low_approval', action.thresholdMicro, allowance, action.newStage,
          action.lowApprovalSince, now)
        notified++
      } else if (action.kind === 'reset') {
        // Same enqueue-first ordering as notify. Dedupe key uses
        // lowApprovalSince (the episode's start) so a payer who recovers,
        // relapses, and recovers again gets one recovered email per episode
        // — not one per tick.
        const policies = await getActivePolicies(config, chainConfig.chainId, c.payer)
        await enqueueApprovalRecoveredEmail(config, chainConfig, c)

        const claimed = await claimReset(config, c, action.priorStage, allowance, now)
        if (!claimed) { skipped++; continue }

        // Reset: use c.lowApprovalSince (the SELECT-time value). Since
        // claimReset has just NULLed the DB column, this is the correct
        // "when did the episode we're closing begin?" answer. May be
        // null if the row's low_approval_since was never populated (edge
        // case with manually-manipulated state) — SDK type reflects
        // that possibility.
        await queueSubscriberWebhooks(config, chainConfig.chainId, c, policies,
          'subscriber.approval_recovered', 0n, allowance, 0, c.lowApprovalSince, now)
        reset++
      } else {
        await refreshTelemetry(config, c, allowance)
        skipped++
      }
    } catch (err) {
      logger.error({ chainId: chainConfig.chainId, payer: c.payer, err }, 'Failed to process candidate')
      // Don't rethrow — one bad payer shouldn't wedge the whole tick.
    }
  }

  const result: MonitorTickResult = {
    candidates: candidates.length,
    notified,
    reset,
    skipped,
    errors: rpcErrors,
  }

  logger.info({ chainId: chainConfig.chainId, ...result }, 'Monitor tick complete')
  return result
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

/**
 * Atomically: advance stage via CAS, seed low_approval_since if first
 * detection, enqueue the low-approval email using the DB-authoritative
 * timestamp as the episode identifier. Returns `won=true` iff this
 * replica's CAS actually landed (i.e. we are the replica responsible
 * for firing the webhook).
 *
 * If the CAS predicate fails (peer replica advanced first, or user opted
 * out between SELECT and here), the whole transaction rolls back — no
 * outbox row, no state mutation. Peer will have queued its own email
 * with the same DB-authoritative timestamp; dedupe_key collision would
 * block a duplicate anyway.
 */
async function notifyTransaction(
  config: RelayerConfig,
  chainConfig: ChainConfig,
  c: Candidate,
  priorStage: number,
  newStage: number,
  nextNotificationAt: Date,
  thresholdMicro: bigint,
  allowance: bigint,
  now: Date,
  policies: AffectedPolicy[]
): Promise<{ won: boolean }> {
  const db = getDb(config.databaseUrl)

  // Best-effort plan-name enrichment outside the tx (read-only, no locks).
  const nameMap = await resolvePlanNames(config, policies)
  const lines = policies.map((p) => ({
    policyId: p.id,
    merchant: p.merchant,
    merchantName: nameMap.get(planKey(p.planMerchant, p.planId))?.merchantName ?? null,
    planName: nameMap.get(planKey(p.planMerchant, p.planId))?.planName ?? null,
    chargeAmountMicro: p.chargeAmountMicro.toString(),
    intervalSeconds: p.intervalSeconds,
  }))
  const topUpMicro = c.projected12moMicro - allowance > 0n
    ? c.projected12moMicro - allowance
    : 0n

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.begin(async (tx: any) => {
      // CAS with COALESCE — first-detection replicas both attempt
      // low_approval_since = NOW(); the row-level lock means whichever
      // commits first "wins" this value, and losers' CAS predicate
      // (notification_stage = priorStage) will fail. Losing replicas
      // throw SKIP_CAS below → transaction rolls back cleanly.
      const rows = await tx<Array<{ low_approval_since: Date }>>`
        UPDATE payer_contacts
        SET notification_stage = ${newStage},
            low_approval_since = COALESCE(low_approval_since, ${now}),
            last_notified_at = ${now},
            next_notification_at = ${nextNotificationAt},
            last_allowance_micro = ${allowance.toString()},
            last_projection_micro = ${c.projected12moMicro.toString()},
            last_checked_at = ${now},
            updated_at = ${now}
        WHERE chain_id = ${c.chainId}
          AND payer = ${c.payer}
          AND notification_stage = ${priorStage}
          AND NOT notifications_opted_out
        RETURNING low_approval_since
      `
      if (rows.length !== 1) throw SKIP_CAS

      // Use the DB-returned timestamp. On first detection this equals `now`
      // for the winning replica (COALESCE seeded it). On subsequent stages
      // it equals the ORIGINAL episode start (COALESCE preserved it).
      // Either way it's deterministic — a losing replica would have
      // observed the winner's value if it had gotten past the CAS.
      const episodeStart = rows[0].low_approval_since
      const episodeKey = episodeStart.getTime().toString()

      await enqueueEmailWithSql(tx, {
        dedupeKey: `low:${chainConfig.chainId}:${c.payer}:${episodeKey}:${newStage}`,
        toAddress: c.email,
        template: 'low_approval',
        payload: {
          chainId: chainConfig.chainId,
          chainName: chainConfig.name,
          payer: c.payer,
          notificationStage: newStage,
          allowanceMicro: allowance.toString(),
          projected12moMicro: c.projected12moMicro.toString(),
          thresholdMicro: thresholdMicro.toString(),
          topUpSuggestionMicro: topUpMicro.toString(),
          topUpUrl: `${config.frontendUrl}/subscriptions?chain=${chainConfig.chainId}`,
          unsubscribeUrl: `${config.publicBaseUrl}/subscribers/unsubscribe?token=${c.optOutToken}`,
          lines,
        },
      })
    })
    return { won: true }
  } catch (err) {
    if (err === SKIP_CAS) return { won: false }
    throw err
  }
}

/** Sentinel used to signal "CAS lost, roll back cleanly" without polluting logs. */
const SKIP_CAS = Symbol('SKIP_CAS')

async function claimReset(
  config: RelayerConfig,
  c: Candidate,
  priorStage: number,
  allowance: bigint,
  now: Date
): Promise<boolean> {
  const db = getDb(config.databaseUrl)
  const rows = await db`
    UPDATE payer_contacts
    SET notification_stage = 0,
        low_approval_since = NULL,
        next_notification_at = NULL,
        last_allowance_micro = ${allowance.toString()},
        last_projection_micro = ${c.projected12moMicro.toString()},
        last_checked_at = ${now},
        updated_at = ${now}
    WHERE chain_id = ${c.chainId}
      AND payer = ${c.payer}
      AND notification_stage = ${priorStage}
    RETURNING 1
  `
  return rows.length === 1
}

async function refreshTelemetry(
  config: RelayerConfig,
  c: Candidate,
  allowance: bigint
): Promise<void> {
  const db = getDb(config.databaseUrl)
  await db`
    UPDATE payer_contacts
    SET last_allowance_micro = ${allowance.toString()},
        last_projection_micro = ${c.projected12moMicro.toString()},
        last_checked_at = NOW()
    WHERE chain_id = ${c.chainId} AND payer = ${c.payer}
  `
}

async function getActivePolicies(
  config: RelayerConfig,
  chainId: number,
  payer: string
): Promise<AffectedPolicy[]> {
  const db = getDb(config.databaseUrl)
  const rows = await db<Array<{
    id: string; merchant: string; charge_amount: string; interval_seconds: number
    plan_id: string | null; plan_merchant: string | null
  }>>`
    SELECT id, merchant, charge_amount, interval_seconds, plan_id, plan_merchant
    FROM policies
    WHERE chain_id = ${chainId} AND payer = ${payer} AND active = true
    ORDER BY created_at
  `
  return rows.map((r) => ({
    id: r.id,
    merchant: r.merchant,
    chargeAmountMicro: BigInt(r.charge_amount),
    intervalSeconds: r.interval_seconds,
    planId: r.plan_id,
    planMerchant: r.plan_merchant,
  }))
}

// ---------------------------------------------------------------------------
// Enqueue helpers
// ---------------------------------------------------------------------------
// enqueueLowApprovalEmail was folded into `notifyTransaction` above so the
// CAS + enqueue happen inside a single transaction — see that fn for the
// rationale (deterministic episode timestamp across replica races).

/**
 * Enqueue the "all clear" email that a payer receives when their allowance
 * has climbed back above the threshold after a low-approval episode.
 *
 * Dedupe key is scoped to the ORIGINAL lowApprovalSince timestamp so we
 * emit exactly one recovered email per episode, even if the payer
 * relapses and recovers repeatedly within a short window.
 * (Fallback: current epoch second when lowApprovalSince is somehow null,
 * so a peer race still produces one email.)
 */
async function enqueueApprovalRecoveredEmail(
  config: RelayerConfig,
  chainConfig: ChainConfig,
  c: Candidate
): Promise<void> {
  const episodeKey = c.lowApprovalSince
    ? c.lowApprovalSince.getTime().toString()
    : Math.floor(Date.now() / 1000).toString()

  await enqueueEmail(config.databaseUrl, {
    dedupeKey: `recover:${chainConfig.chainId}:${c.payer}:${episodeKey}`,
    toAddress: c.email,
    template: 'approval_recovered',
    payload: {
      chainName: chainConfig.name,
      unsubscribeUrl: `${config.publicBaseUrl}/subscribers/unsubscribe?token=${c.optOutToken}`,
    },
  })
}

async function resolvePlanNames(
  config: RelayerConfig,
  policies: AffectedPolicy[]
): Promise<Map<string, { planName: string | null; merchantName: string | null }>> {
  const pairs = policies
    .filter((p) => p.planId && p.planMerchant)
    .map((p) => [p.planId as string, p.planMerchant as string] as const)
  if (pairs.length === 0) return new Map()

  const db = getDb(config.databaseUrl)
  const ids = pairs.map(([id]) => id)
  const merchants = pairs.map(([, m]) => m.toLowerCase())

  const rows = await db<Array<{
    id: string; merchant_address: string; metadata: { plan?: { name?: string }; merchant?: { name?: string } }
  }>>`
    SELECT id, merchant_address, metadata
    FROM plan_metadata
    WHERE (id, merchant_address) IN (
      SELECT * FROM UNNEST(${db.array(ids)}::TEXT[], ${db.array(merchants)}::TEXT[])
    )
  `

  const map = new Map<string, { planName: string | null; merchantName: string | null }>()
  for (const r of rows) {
    map.set(planKey(r.merchant_address, r.id), {
      planName: r.metadata?.plan?.name ?? null,
      merchantName: r.metadata?.merchant?.name ?? null,
    })
  }
  return map
}

function planKey(merchant: string | null, id: string | null): string {
  return `${(merchant ?? '').toLowerCase()}::${id ?? ''}`
}

async function queueSubscriberWebhooks(
  config: RelayerConfig,
  chainId: number,
  c: Candidate,
  policies: AffectedPolicy[],
  event: 'subscriber.low_approval' | 'subscriber.approval_recovered',
  thresholdMicro: bigint,
  allowanceMicro: bigint,
  notificationStage: number,
  // Explicit episode start — passed by the notify branch as
  // `action.lowApprovalSince` (guaranteed non-null via `?? now` in decide()),
  // and by the reset branch as `c.lowApprovalSince` (from SELECT, usually
  // set but defensively-nullable). Absent from the payload if null, which
  // is why the SDK type marks it optional.
  lowApprovalSince: Date | null,
  now: Date
): Promise<void> {
  // Merchants configure webhooks per-merchant, so we fire ONE webhook per
  // active policy — each merchant hears about each of their at-risk subs.
  for (const p of policies) {
    const payload: WebhookPayload = {
      event,
      timestamp: now.toISOString(),
      data: {
        policyId: p.id,
        chainId,
        payer: c.payer,
        merchant: p.merchant,
        notificationStage,
        currentAllowance: allowanceMicro.toString(),
        projected12mo: c.projected12moMicro.toString(),
        threshold: thresholdMicro.toString(),
        lowApprovalSince: lowApprovalSince?.toISOString(),
      },
    }
    try {
      await queueWebhook(config.databaseUrl, p.id, event, payload)
    } catch (err) {
      logger.warn({ policyId: p.id, event, err }, 'Failed to queue webhook (non-fatal)')
    }
  }
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

export async function startApprovalMonitorLoop(
  config: RelayerConfig,
  chainConfig: ChainConfig,
  signal: AbortSignal
): Promise<void> {
  if (!config.approvalMonitor.enabled) {
    logger.info({ chainId: chainConfig.chainId }, 'Approval monitor disabled — skipping')
    return
  }

  logger.info(
    { chainId: chainConfig.chainId, intervalMs: config.approvalMonitor.runIntervalMs },
    'Starting approval monitor loop'
  )

  while (!signal.aborted) {
    try {
      await runApprovalMonitorOnce(config, chainConfig)
    } catch (err) {
      logger.error({ chainId: chainConfig.chainId, err }, 'Approval monitor tick failed')
    }
    await sleep(config.approvalMonitor.runIntervalMs, signal)
  }

  logger.info({ chainId: chainConfig.chainId }, 'Approval monitor loop stopped')
}
