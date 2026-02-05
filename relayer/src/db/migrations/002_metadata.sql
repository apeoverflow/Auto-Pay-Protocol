-- Metadata storage for subscription plans

CREATE TABLE IF NOT EXISTS plan_metadata (
  id TEXT PRIMARY KEY,                  -- metadata ID (used in URL)
  merchant_address TEXT NOT NULL,       -- merchant who owns this metadata
  metadata JSONB NOT NULL,              -- the full metadata JSON
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_metadata_merchant ON plan_metadata(merchant_address);
