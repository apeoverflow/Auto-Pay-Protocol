CREATE TABLE IF NOT EXISTS merchant_api_keys (
  id SERIAL PRIMARY KEY,
  merchant TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_merchant_api_keys_merchant ON merchant_api_keys(merchant);
CREATE INDEX IF NOT EXISTS idx_merchant_api_keys_hash ON merchant_api_keys(key_hash);
