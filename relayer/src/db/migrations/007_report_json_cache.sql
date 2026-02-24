-- Add report_json column for caching full report data in the DB
ALTER TABLE merchant_reports ADD COLUMN IF NOT EXISTS report_json JSONB;

-- Allow reports to exist without an IPFS CID (local-only reports)
ALTER TABLE merchant_reports ALTER COLUMN cid DROP NOT NULL;
