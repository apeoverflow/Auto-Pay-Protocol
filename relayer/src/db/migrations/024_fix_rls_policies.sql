-- Fix RLS policies on merchant_accounts: drop overly permissive policies from 022,
-- replace with properly scoped anon-only SELECT policy.

-- Drop old merchant_accounts policies (IF EXISTS handles fresh installs)
DROP POLICY IF EXISTS "merchant_accounts_select" ON merchant_accounts;
DROP POLICY IF EXISTS "merchant_accounts_insert" ON merchant_accounts;

-- Recreate with proper anon scope (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_merchant_accounts' AND tablename = 'merchant_accounts'
  ) THEN
    CREATE POLICY "anon_select_merchant_accounts"
      ON merchant_accounts FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Drop any anon SELECT on whitelist_addresses — no direct Supabase access needed,
-- reads go through relayer API only
DROP POLICY IF EXISTS "whitelist_select" ON whitelist_addresses;
DROP POLICY IF EXISTS "anon_select_whitelist" ON whitelist_addresses;
