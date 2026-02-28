-- Enable Row-Level Security on all tables
-- The relayer uses the service role (bypasses RLS), so only anon access is affected.

-- Create waitlist_emails table (was created manually, needs a migration)
CREATE TABLE IF NOT EXISTS waitlist_emails (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on every table
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE indexer_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriber_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_emails ENABLE ROW LEVEL SECURITY;

-- Anon SELECT policies: on-chain data, publicly visible via events
CREATE POLICY "anon_select_policies"
  ON policies FOR SELECT
  TO anon
  USING (true);

-- Anon SELECT charges: on-chain data, publicly visible via events
CREATE POLICY "anon_select_charges"
  ON charges FOR SELECT
  TO anon
  USING (true);

-- Anon SELECT active plans: public catalog for checkout pages
CREATE POLICY "anon_select_active_plans"
  ON plan_metadata FOR SELECT
  TO anon
  USING (status = 'active');

-- Anon SELECT checkout links: needed to resolve short links
CREATE POLICY "anon_select_checkout_links"
  ON checkout_links FOR SELECT
  TO anon
  USING (true);

-- Anon INSERT waitlist emails: email capture form
CREATE POLICY "anon_insert_waitlist"
  ON waitlist_emails FOR INSERT
  TO anon
  WITH CHECK (true);
