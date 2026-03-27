-- Merchant accounts: require email verification to access merchant dashboard
CREATE TABLE IF NOT EXISTS merchant_accounts (
  address TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  supabase_user_id UUID,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_merchant_accounts_email ON merchant_accounts(email);

ALTER TABLE merchant_accounts ENABLE ROW LEVEL SECURITY;

-- Anon can read (frontend checks registration status via relayer)
CREATE POLICY "anon_select_merchant_accounts"
  ON merchant_accounts FOR SELECT
  TO anon
  USING (true);

-- No anon INSERT/UPDATE/DELETE — only service role (relayer API with wallet signature auth) can write
