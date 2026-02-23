-- Migration 006: Composite primary key for plan_metadata + plan_id on policies
--
-- Fixes:
-- 1. Plan ID collisions in shared DB (different merchants can now use same plan slug)
-- 2. Adds plan_id/plan_merchant columns to policies for soft FK lookups
-- 3. Scopes upsert by merchant via composite PK

-- Step 1: Change plan_metadata PK from (id) to (id, merchant_address)
ALTER TABLE plan_metadata DROP CONSTRAINT plan_metadata_pkey;
ALTER TABLE plan_metadata ADD PRIMARY KEY (id, merchant_address);

-- Step 2: Add plan reference columns to policies
ALTER TABLE policies ADD COLUMN IF NOT EXISTS plan_id TEXT;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS plan_merchant TEXT;
CREATE INDEX IF NOT EXISTS idx_policies_plan ON policies(plan_id, plan_merchant);

-- Step 3: Backfill plan_id from metadata_url for existing policies
-- New format: /metadata/0xABC.../pro-plan
UPDATE policies
SET
  plan_merchant = lower(substring(metadata_url from '/metadata/(0x[a-fA-F0-9]{40})/[^/]+$')),
  plan_id = substring(metadata_url from '/metadata/0x[a-fA-F0-9]{40}/([^/?#]+)$')
WHERE metadata_url IS NOT NULL
  AND metadata_url ~ '/metadata/0x[a-fA-F0-9]{40}/[^/]+$'
  AND plan_id IS NULL;

-- Legacy format: /metadata/pro-plan (merchant unknown)
UPDATE policies
SET plan_id = substring(metadata_url from '/metadata/([^/?#]+)$')
WHERE metadata_url IS NOT NULL
  AND metadata_url ~ '/metadata/[^/]+$'
  AND metadata_url !~ '/metadata/0x[a-fA-F0-9]{40}/'
  AND plan_id IS NULL;
