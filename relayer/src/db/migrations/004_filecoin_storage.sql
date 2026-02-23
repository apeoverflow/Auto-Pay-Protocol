-- Filecoin storage integration: receipt CIDs, merchant profiles, plan billing, reports

-- charges: receipt CID from IPFS/Filecoin
ALTER TABLE charges ADD COLUMN receipt_cid TEXT;

-- merchants: self-service profile fields
ALTER TABLE merchants ADD COLUMN encryption_key TEXT;
ALTER TABLE merchants ADD COLUMN name TEXT;
ALTER TABLE merchants ADD COLUMN website TEXT;
ALTER TABLE merchants ADD COLUMN support_email TEXT;
ALTER TABLE merchants ADD COLUMN profile_cid TEXT;
ALTER TABLE merchants ADD COLUMN registered_at TIMESTAMPTZ;

-- plan_metadata: IPFS snapshot CID + billing display fields
ALTER TABLE plan_metadata ADD COLUMN ipfs_cid TEXT;
ALTER TABLE plan_metadata ADD COLUMN amount TEXT;
ALTER TABLE plan_metadata ADD COLUMN interval_label TEXT;
ALTER TABLE plan_metadata ADD COLUMN spending_cap TEXT;

-- merchant_reports: encrypted report CIDs (chain-specific)
CREATE TABLE merchant_reports (
  id SERIAL PRIMARY KEY,
  merchant_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  period TEXT NOT NULL,
  cid TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_address, chain_id, period)
);
CREATE INDEX idx_merchant_reports_merchant ON merchant_reports(merchant_address, chain_id);

-- webhooks: denormalize merchant_address for efficient delivery history queries
ALTER TABLE webhooks ADD COLUMN merchant_address TEXT;

-- Backfill merchant_address from policies table
UPDATE webhooks w SET merchant_address = p.merchant
FROM policies p WHERE w.policy_id = p.id;

CREATE INDEX idx_webhooks_merchant ON webhooks(merchant_address);
