-- Add consecutive failure tracking columns to policies table
ALTER TABLE policies ADD COLUMN consecutive_failures INTEGER DEFAULT 0;
ALTER TABLE policies ADD COLUMN last_failure_reason TEXT;
ALTER TABLE policies ADD COLUMN cancelled_by_failure BOOLEAN DEFAULT false;
ALTER TABLE policies ADD COLUMN cancelled_at TIMESTAMPTZ;
