-- Track receipt IPFS upload status so we can retry failures.
-- Previously receipt_cid was NULL with no way to distinguish "never attempted" from "failed".

ALTER TABLE charges ADD COLUMN receipt_upload_status TEXT DEFAULT 'skipped'
  CHECK (receipt_upload_status IN ('skipped', 'pending', 'uploaded', 'failed'));

ALTER TABLE charges ADD COLUMN receipt_upload_error TEXT;
ALTER TABLE charges ADD COLUMN receipt_retry_count INTEGER DEFAULT 0;
ALTER TABLE charges ADD COLUMN receipt_last_retry_at TIMESTAMPTZ;

-- Backfill: charges that already have a CID are 'uploaded'
UPDATE charges SET receipt_upload_status = 'uploaded' WHERE receipt_cid IS NOT NULL;

-- Historical charges without a CID are left as 'skipped' (not 'pending').
-- We cannot know whether Storacha was configured when they were created.
-- To backfill historical receipts after configuring Storacha, run manually:
--   UPDATE charges SET receipt_upload_status = 'pending'
--   WHERE status = 'success' AND receipt_cid IS NULL AND receipt_upload_status = 'skipped';

-- Partial index for the retry loop query
CREATE INDEX idx_charges_receipt_pending ON charges(receipt_upload_status)
  WHERE receipt_upload_status IN ('pending', 'failed');
