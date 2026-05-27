-- Tempo server-side wallet mapping: Privy user ID → wallet
CREATE TABLE IF NOT EXISTS tempo_wallets (
  privy_user_id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL,
  address TEXT NOT NULL,
  email TEXT,
  funded_at TIMESTAMPTZ,  -- NULL = not yet funded, set after $0.10 USDC.e drip
  created_at TIMESTAMPTZ DEFAULT NOW()
);
