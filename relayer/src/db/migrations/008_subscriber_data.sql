-- Subscriber data collected during checkout (email, discord, etc.)
CREATE TABLE IF NOT EXISTS subscriber_data (
  id SERIAL PRIMARY KEY,
  policy_id TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  payer TEXT NOT NULL,
  merchant TEXT NOT NULL,
  plan_id TEXT,
  plan_merchant TEXT,
  form_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (policy_id, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriber_data_merchant ON subscriber_data(merchant);
CREATE INDEX IF NOT EXISTS idx_subscriber_data_plan ON subscriber_data(plan_id, plan_merchant);
