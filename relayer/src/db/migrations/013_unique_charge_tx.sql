-- Prevent duplicate charge records with the same tx_hash.
-- The executor could create duplicates if two processes pick up the same
-- policy concurrently (before FOR UPDATE SKIP LOCKED was added).
CREATE UNIQUE INDEX IF NOT EXISTS idx_charges_unique_tx
  ON charges (policy_id, chain_id, tx_hash)
  WHERE tx_hash IS NOT NULL;
