-- Fix policies where charge_count and total_spent were inflated by
-- the indexer double-counting charges already processed by the executor.
-- Reconcile from the charges table (which is now deduplicated by 013).

-- charge_count = 1 (from createPolicy) + number of successful executor charges
-- total_spent  = charge_amount * charge_count
UPDATE policies p
SET
  charge_count = 1 + COALESCE(agg.real_charges, 0),
  total_spent  = (
    CAST(p.charge_amount AS NUMERIC) * (1 + COALESCE(agg.real_charges, 0))
  )::TEXT
FROM (
  SELECT policy_id, chain_id, COUNT(*) AS real_charges
  FROM charges
  WHERE status = 'success' AND tx_hash IS NOT NULL
  GROUP BY policy_id, chain_id
) agg
WHERE p.id = agg.policy_id
  AND p.chain_id = agg.chain_id
  AND p.charge_count > 1 + agg.real_charges;
