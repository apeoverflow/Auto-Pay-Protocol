-- One-time USDC payment tracking
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  block_number BIGINT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_from ON payments(from_address);
CREATE INDEX IF NOT EXISTS idx_payments_to ON payments(to_address);
