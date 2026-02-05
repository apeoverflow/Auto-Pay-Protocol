-- Initial schema for AutoPay relayer

-- Policies table - indexed from PolicyCreated events
CREATE TABLE IF NOT EXISTS policies (
  id TEXT NOT NULL,                     -- policyId (bytes32 as hex)
  chain_id INTEGER NOT NULL,
  payer TEXT NOT NULL,
  merchant TEXT NOT NULL,
  charge_amount TEXT NOT NULL,          -- stored as string to avoid precision loss
  spending_cap TEXT NOT NULL,
  total_spent TEXT DEFAULT '0',
  interval_seconds INTEGER NOT NULL,
  last_charged_at TIMESTAMPTZ,
  next_charge_at TIMESTAMPTZ NOT NULL,  -- calculated: last_charged_at + interval
  charge_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  metadata_url TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_block BIGINT NOT NULL,
  created_tx TEXT NOT NULL,
  PRIMARY KEY (id, chain_id)
);

-- Charges table - records of charge executions
CREATE TABLE IF NOT EXISTS charges (
  id SERIAL PRIMARY KEY,
  policy_id TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'success', 'failed'
  amount TEXT NOT NULL,
  protocol_fee TEXT,
  error_message TEXT,
  attempt_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  FOREIGN KEY (policy_id, chain_id) REFERENCES policies(id, chain_id)
);

-- Indexer state - tracks last indexed block per chain
CREATE TABLE IF NOT EXISTS indexer_state (
  chain_id INTEGER PRIMARY KEY,
  last_indexed_block BIGINT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhooks - delivery queue
CREATE TABLE IF NOT EXISTS webhooks (
  id SERIAL PRIMARY KEY,
  policy_id TEXT NOT NULL,
  charge_id INTEGER REFERENCES charges(id),
  event_type TEXT NOT NULL,               -- 'charge.succeeded', 'charge.failed', 'policy.created', 'policy.revoked'
  payload TEXT NOT NULL,                  -- JSON
  status TEXT DEFAULT 'pending',          -- 'pending', 'sent', 'failed'
  attempts INTEGER DEFAULT 0,
  next_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Merchants - webhook configuration
CREATE TABLE IF NOT EXISTS merchants (
  address TEXT PRIMARY KEY,
  webhook_url TEXT,
  webhook_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_policies_payer ON policies(payer);
CREATE INDEX IF NOT EXISTS idx_policies_merchant ON policies(merchant);
CREATE INDEX IF NOT EXISTS idx_policies_next_charge ON policies(chain_id, active, next_charge_at)
  WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_charges_status ON charges(status, created_at);
CREATE INDEX IF NOT EXISTS idx_charges_policy ON charges(policy_id, chain_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_pending ON webhooks(status, next_attempt_at)
  WHERE status = 'pending';
