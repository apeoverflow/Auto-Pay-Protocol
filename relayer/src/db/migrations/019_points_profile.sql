-- Add profile submission action worth 50 points
INSERT INTO points_actions (action_id, display_name, description, points, category, frequency, cooldown_seconds, source_type)
VALUES ('submit_profile', 'Complete Profile', 'Share your email, company, and feedback', 100, 'onboarding', 'once', 0, 'off-chain')
ON CONFLICT (action_id) DO NOTHING;

-- Add wallet_address, company, feedback columns to waitlist_emails if the table exists
-- (The table lives in Supabase, so this ALTER may need to run there directly)
-- ALTER TABLE waitlist_emails ADD COLUMN IF NOT EXISTS wallet_address TEXT;
-- ALTER TABLE waitlist_emails ADD COLUMN IF NOT EXISTS company TEXT;
-- ALTER TABLE waitlist_emails ADD COLUMN IF NOT EXISTS feedback TEXT;
