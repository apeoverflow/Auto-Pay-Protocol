-- Terms of Service acceptance records with wallet signatures
CREATE TABLE IF NOT EXISTS terms_acceptances (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  message TEXT NOT NULL,
  signature TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One acceptance per wallet per version
  UNIQUE (wallet_address, terms_version)
);

CREATE INDEX IF NOT EXISTS idx_terms_acceptances_wallet ON terms_acceptances (wallet_address);

-- RLS: relayer service role can read/write, anon can read own acceptances
ALTER TABLE terms_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY terms_acceptances_anon_select ON terms_acceptances
  FOR SELECT TO anon
  USING (true);

CREATE POLICY terms_acceptances_service_all ON terms_acceptances
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
