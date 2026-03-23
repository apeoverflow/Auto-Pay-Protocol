-- Reset points worker state to reprocess all charges and policies
-- This is needed because the initial run may have skipped entries
-- due to interval/amount filters that have since been relaxed.
UPDATE points_worker_state SET
  last_processed_charge_id = 0,
  last_processed_policy_created_at = '1970-01-01',
  last_processed_terms_at = '1970-01-01',
  last_loyalty_check_at = '1970-01-01'
WHERE id = 1;

-- Clear any previously awarded points so they can be re-awarded correctly
-- (idempotency keys prevent duplicates, but the cursor reset means
--  we need to clear stale entries from the relaxed filters)
TRUNCATE points_events;
TRUNCATE points_balances;
