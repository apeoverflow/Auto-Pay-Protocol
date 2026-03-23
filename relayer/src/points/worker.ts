import { createLogger } from '../utils/logger.js'
import {
  getWorkerState, updateWorkerState, awardPoints, getNewCharges,
  getNewPolicies, getNewTermsAcceptances, getActivePoliciesForLoyalty,
  countUniquePayerMerchants, countUniqueMerchantPayers, getPendingReferral,
  countMonthlyConfirmedReferrals, confirmReferral, countSuccessfulChargesForPayer,
  hasMerchantPlan,
  MIN_INTERVAL_SECONDS, MIN_CHARGE_AMOUNT,
} from '../db/points.js'
import type { RelayerConfig } from '../types.js'

const logger = createLogger('points-worker')

const LOYALTY_CHECK_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

export async function startPointsWorkerLoop(
  config: RelayerConfig,
  signal: AbortSignal
): Promise<void> {
  logger.info('Points worker started')

  while (!signal.aborted) {
    try {
      await processPointsCycle(config)
    } catch (err) {
      logger.error({ err }, 'Points worker error')
    }

    // Wait 60 seconds or until aborted
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 60_000)
      signal.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
    })
  }

  logger.info('Points worker stopped')
}

async function processPointsCycle(config: RelayerConfig) {
  const state = await getWorkerState(config.databaseUrl)

  // 1. Process new successful charges (primary points driver)
  await processCharges(config.databaseUrl, state.last_processed_charge_id)

  // 2. Process new policies (milestone bonuses)
  await processPolicies(config.databaseUrl, state.last_processed_policy_created_at)

  // 3. Process new terms acceptances
  await processTerms(config.databaseUrl, state.last_processed_terms_at)

  // 4. Check loyalty milestones (every 10 min)
  const now = Date.now()
  const lastLoyalty = state.last_loyalty_check_at?.getTime() || 0
  if (now - lastLoyalty >= LOYALTY_CHECK_INTERVAL_MS) {
    await processLoyalty(config.databaseUrl)
    await updateWorkerState(config.databaseUrl, { last_loyalty_check_at: new Date() })
  }
}

// ── Charge processing ────────────────────────────────────────

async function processCharges(databaseUrl: string, afterId: number) {
  const charges = await getNewCharges(databaseUrl, afterId)
  if (charges.length === 0) return

  let maxId = afterId

  for (const charge of charges) {
    const { id, policy_id, chain_id, amount, tx_hash, payer, merchant, interval_seconds } = charge as any

    if (Number(id) > maxId) maxId = Number(id)

    // Skip self-dealing
    if (payer === merchant) continue

    // Skip sub-minimum charges
    if (BigInt(charge.charge_amount) < BigInt(MIN_CHARGE_AMOUNT)) continue

    // Skip high-frequency intervals (< 24h)
    if (interval_seconds < MIN_INTERVAL_SECONDS) continue

    const usdcAmount = parseInt(amount) / 1_000_000
    const points = Math.max(1, Math.round(usdcAmount * 10)) // min 1 pt per successful charge

    // Award payer points
    await awardPoints(databaseUrl, {
      action_id: 'charge_value_payer',
      wallet: payer,
      points,
      usdc_amount: usdcAmount,
      chain_id,
      source_type: 'on-chain',
      source_ref: `${chain_id}:${tx_hash}`,
      idempotency_key: `charge_value_payer:${chain_id}:${tx_hash}`,
      metadata: { merchant, policy_id },
    })

    // Award merchant points
    await awardPoints(databaseUrl, {
      action_id: 'charge_value_merchant',
      wallet: merchant,
      points,
      usdc_amount: usdcAmount,
      chain_id,
      source_type: 'on-chain',
      source_ref: `${chain_id}:${tx_hash}`,
      idempotency_key: `charge_value_merchant:${chain_id}:${tx_hash}`,
      metadata: { payer, policy_id },
    })

    // Check referral confirmation
    await checkReferralConfirmation(databaseUrl, payer, chain_id, policy_id, tx_hash, points)
  }

  if (maxId > afterId) {
    await updateWorkerState(databaseUrl, { last_processed_charge_id: maxId })
  }

  if (charges.length > 0) {
    logger.info({ count: charges.length, maxId }, 'Processed charges for points')
  }
}

async function checkReferralConfirmation(
  databaseUrl: string,
  payer: string,
  chainId: number,
  policyId: string,
  txHash: string,
  chargePoints: number
) {
  const referral = await getPendingReferral(databaseUrl, payer)
  if (!referral) return

  // Check if this is the second charge (first recurring after create-time charge)
  const totalCharges = await countSuccessfulChargesForPayer(databaseUrl, payer, chainId)
  if (totalCharges !== 2) return

  // Check monthly cap
  const monthlyCount = await countMonthlyConfirmedReferrals(databaseUrl, referral.referrer)
  if (monthlyCount >= 50) {
    logger.info({ referrer: referral.referrer, referred: payer }, 'Referral monthly cap reached, skipping')
    return
  }

  // Award referrer value-based points (same rate)
  const awarded = await awardPoints(databaseUrl, {
    action_id: 'referral_value',
    wallet: referral.referrer,
    points: chargePoints,
    usdc_amount: chargePoints / 10, // reverse the 10x multiplier
    chain_id: chainId,
    source_type: 'on-chain',
    source_ref: `${chainId}:${txHash}`,
    idempotency_key: `referral_value:${chainId}:${txHash}`,
    metadata: { referred: payer, policy_id: policyId },
  })

  if (awarded) {
    await confirmReferral(databaseUrl, referral.id, policyId, chainId)
    logger.info({ referrer: referral.referrer, referred: payer, points: chargePoints }, 'Referral confirmed')
  }
}

// ── Policy milestone processing ──────────────────────────────

async function processPolicies(databaseUrl: string, afterDate: Date) {
  const policies = await getNewPolicies(databaseUrl, afterDate)
  if (policies.length === 0) return

  let maxDate = afterDate

  for (const policy of policies) {
    const { chain_id, payer, merchant, charge_amount, interval_seconds, created_at, created_tx } = policy as any

    const createdDate = new Date(created_at)
    if (createdDate > maxDate) maxDate = createdDate

    // Skip sub-minimum or high-frequency
    if (BigInt(charge_amount) < BigInt(MIN_CHARGE_AMOUNT)) continue
    if (interval_seconds < MIN_INTERVAL_SECONDS) continue

    // Payer milestones
    const uniqueMerchants = await countUniquePayerMerchants(databaseUrl, payer)

    if (uniqueMerchants === 1) {
      await awardPoints(databaseUrl, {
        action_id: 'first_subscription',
        wallet: payer, points: 100, usdc_amount: null, chain_id,
        source_type: 'on-chain', source_ref: `${chain_id}:${created_tx}`,
        idempotency_key: `first_subscription:${payer}`,
      })
    }
    if (uniqueMerchants === 5) {
      await awardPoints(databaseUrl, {
        action_id: 'subscription_5',
        wallet: payer, points: 250, usdc_amount: null, chain_id,
        source_type: 'on-chain', source_ref: `${chain_id}:${created_tx}`,
        idempotency_key: `subscription_5:${payer}`,
      })
    }
    if (uniqueMerchants === 10) {
      await awardPoints(databaseUrl, {
        action_id: 'subscription_10',
        wallet: payer, points: 500, usdc_amount: null, chain_id,
        source_type: 'on-chain', source_ref: `${chain_id}:${created_tx}`,
        idempotency_key: `subscription_10:${payer}`,
      })
    }

    // Merchant milestones
    const uniquePayers = await countUniqueMerchantPayers(databaseUrl, merchant)

    if (uniquePayers === 1) {
      await awardPoints(databaseUrl, {
        action_id: 'merchant_first_subscriber',
        wallet: merchant, points: 200, usdc_amount: null, chain_id,
        source_type: 'on-chain', source_ref: `${chain_id}:${created_tx}`,
        idempotency_key: `merchant_first_subscriber:${merchant}`,
      })
    }

    const merchantMilestones = [
      { threshold: 10, action: 'merchant_10_subscribers', pts: 500 },
      { threshold: 50, action: 'merchant_50_subscribers', pts: 1000 },
      { threshold: 100, action: 'merchant_100_subscribers', pts: 2000 },
    ]
    for (const m of merchantMilestones) {
      if (uniquePayers === m.threshold) {
        await awardPoints(databaseUrl, {
          action_id: m.action,
          wallet: merchant, points: m.pts, usdc_amount: null, chain_id,
          source_type: 'on-chain', source_ref: `${chain_id}:${created_tx}`,
          idempotency_key: `${m.action}:${merchant}`,
        })
      }
    }

    // Merchant first plan check
    const hasPlan = await hasMerchantPlan(databaseUrl, merchant)
    if (hasPlan) {
      await awardPoints(databaseUrl, {
        action_id: 'merchant_first_plan',
        wallet: merchant, points: 100, usdc_amount: null, chain_id: null,
        source_type: 'on-chain', source_ref: `plan:${merchant}`,
        idempotency_key: `merchant_first_plan:${merchant}`,
      })
    }
  }

  if (maxDate > afterDate) {
    await updateWorkerState(databaseUrl, { last_processed_policy_created_at: maxDate })
  }
}

// ── Terms acceptance processing ──────────────────────────────

async function processTerms(databaseUrl: string, afterDate: Date) {
  const acceptances = await getNewTermsAcceptances(databaseUrl, afterDate)
  if (acceptances.length === 0) return

  let maxDate = afterDate

  for (const row of acceptances) {
    const { wallet_address, accepted_at } = row as any
    const date = new Date(accepted_at)
    if (date > maxDate) maxDate = date

    await awardPoints(databaseUrl, {
      action_id: 'accept_terms',
      wallet: wallet_address, points: 5, usdc_amount: null, chain_id: null,
      source_type: 'on-chain', source_ref: `terms:${wallet_address}`,
      idempotency_key: `accept_terms:${wallet_address}`,
    })
  }

  await updateWorkerState(databaseUrl, { last_processed_terms_at: maxDate })
}

// ── Loyalty milestone processing ─────────────────────────────

async function processLoyalty(databaseUrl: string) {
  const policies = await getActivePoliciesForLoyalty(databaseUrl)
  const now = Date.now()

  const milestones = [
    { days: 30, action: 'loyalty_1m', pts: 100 },
    { days: 90, action: 'loyalty_3m', pts: 250 },
    { days: 180, action: 'loyalty_6m', pts: 500 },
  ]

  for (const policy of policies) {
    const { id, chain_id, payer, created_at, charge_count, interval_seconds } = policy as any
    if (interval_seconds < MIN_INTERVAL_SECONDS) continue

    const ageMs = now - new Date(created_at).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)

    for (const m of milestones) {
      if (ageDays >= m.days) {
        // Verify proportional charges exist
        const expectedCharges = Math.floor(m.days / (interval_seconds / 86400))
        if (charge_count >= Math.max(expectedCharges, 2)) { // at least 2 charges (first + 1 recurring)
          await awardPoints(databaseUrl, {
            action_id: m.action,
            wallet: payer, points: m.pts, usdc_amount: null, chain_id,
            source_type: 'on-chain', source_ref: `loyalty:${chain_id}:${id}`,
            idempotency_key: `${m.action}:${chain_id}:${id}`,
          })
        }
      }
    }
  }
}
