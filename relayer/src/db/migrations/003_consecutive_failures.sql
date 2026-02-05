-- Add consecutive failure tracking columns to policies table

ALTER TABLE policies ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS last_failure_reason TEXT;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS cancelled_by_failure BOOLEAN DEFAULT false;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
