CREATE TABLE IF NOT EXISTS checkout_links (
  short_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  merchant_address TEXT NOT NULL,
  success_url TEXT,
  cancel_url TEXT,
  fields TEXT,                    -- "email:r,name:o" format
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (plan_id, merchant_address)
    REFERENCES plan_metadata(id, merchant_address) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_checkout_links_plan ON checkout_links(plan_id, merchant_address);
CREATE INDEX IF NOT EXISTS idx_checkout_links_merchant ON checkout_links(merchant_address);
