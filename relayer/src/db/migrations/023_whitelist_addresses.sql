-- Whitelisted addresses can bypass the $10 minimum subscription charge
CREATE TABLE IF NOT EXISTS whitelist_addresses (
  address TEXT PRIMARY KEY,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE whitelist_addresses ENABLE ROW LEVEL SECURITY;

-- No anon access — reads go through the relayer API (/whitelist/:address),
-- writes go through admin endpoints. Relayer uses service role (bypasses RLS).
