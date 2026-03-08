-- Prevent duplicate charge records with the same tx_hash.
-- Dedup existing data, then create unique index.
-- NOTE: Runs inside a library-managed transaction (see migration runner).

-- Clean up existing duplicates: keep the oldest charge per (policy_id, chain_id, tx_hash).
-- Must delete referencing webhooks first (FK constraint).
DELETE FROM webhooks
WHERE charge_id IN (
  SELECT id FROM charges
  WHERE tx_hash IS NOT NULL
    AND id NOT IN (
      SELECT MIN(id)
      FROM charges
      WHERE tx_hash IS NOT NULL
      GROUP BY policy_id, chain_id, tx_hash
    )
);

DELETE FROM charges
WHERE tx_hash IS NOT NULL
  AND id NOT IN (
    SELECT MIN(id)
    FROM charges
    WHERE tx_hash IS NOT NULL
    GROUP BY policy_id, chain_id, tx_hash
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_charges_unique_tx
  ON charges (policy_id, chain_id, tx_hash)
  WHERE tx_hash IS NOT NULL;
