-- ============================================================
-- Fix missing RLS on tables created in migrations 017, 020, 021
-- and tighten overly permissive policies on 012 and 016.
--
-- Principle: the relayer uses service_role (bypasses RLS).
-- Only grant anon access where the frontend queries Supabase directly.
-- ============================================================

-- ── 1. Enable RLS on all unprotected tables ──────────────────

ALTER TABLE points_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_worker_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tempo_wallets ENABLE ROW LEVEL SECURITY;

-- No anon policies on any of these tables.
-- All reads/writes go through the relayer API (service_role).
-- With RLS enabled and no anon policies, direct Supabase access
-- via the public anon key is denied by default.

-- ── 2. Tighten terms_acceptances ─────────────────────────────
-- Old policy grants anon SELECT on ALL rows (leaks every wallet's
-- signature). The frontend doesn't query this table directly —
-- it goes through GET /terms/check/:address on the relayer.

DROP POLICY IF EXISTS terms_acceptances_anon_select ON terms_acceptances;

-- ── 3. Restrict waitlist_emails INSERT ───────────────────────
-- The frontend does INSERT directly via Supabase anon key, so we
-- keep the INSERT policy but add an email format constraint.

DROP POLICY IF EXISTS "anon_insert_waitlist" ON waitlist_emails;

CREATE POLICY "anon_insert_waitlist" ON waitlist_emails
  FOR INSERT TO anon
  WITH CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 5 AND 320
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  );
