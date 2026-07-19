-- Migration 029: Low-approval notification system
--
-- Adds four tables that together power proactive low-approval warnings to
-- subscribers (and provide the at-risk list to merchants):
--
--   payer_contacts             — one row per (chain_id, payer). Verified email,
--                                opt-out preference, notification cadence state.
--   payer_projections          — materialised 12-month projected billing per payer.
--                                Recomputed by the indexer on any policy state
--                                change so the cron never scans the full policies
--                                table.
--   payer_email_verifications  — one-time magic-link tokens for email verification.
--                                Separate from merchant login codes.
--   email_outbox               — retryable transactional-email queue. Mirrors the
--                                pattern used by the webhooks table but adds
--                                dedupe_key (idempotent enqueue) and leased_until
--                                (crash-safe claim) so we can safely run more
--                                than one relayer replica.

-- ============================================================================
-- payer_contacts
-- ============================================================================
CREATE TABLE payer_contacts (
  chain_id INTEGER NOT NULL,
  payer TEXT NOT NULL,
  email TEXT,
  email_verified_at TIMESTAMPTZ,
  notifications_opted_out BOOLEAN NOT NULL DEFAULT false,
  opt_out_token TEXT NOT NULL,
  notification_stage SMALLINT NOT NULL DEFAULT 0,
  low_approval_since TIMESTAMPTZ,
  last_notified_at TIMESTAMPTZ,
  next_notification_at TIMESTAMPTZ,
  last_projection_micro NUMERIC,
  last_allowance_micro NUMERIC,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, payer)
);

-- Partial index: only rows the approval monitor could ever notify.
-- Order by next_notification_at NULLS FIRST so stage-0 detections drain first.
CREATE INDEX idx_payer_contacts_notifiable
  ON payer_contacts (chain_id, next_notification_at NULLS FIRST)
  WHERE email IS NOT NULL
    AND email_verified_at IS NOT NULL
    AND NOT notifications_opted_out;

-- Lookup by opt_out_token for the unsubscribe endpoint (rare, tiny table).
CREATE INDEX idx_payer_contacts_opt_out_token ON payer_contacts (opt_out_token);

-- ============================================================================
-- payer_projections
-- ============================================================================
CREATE TABLE payer_projections (
  chain_id INTEGER NOT NULL,
  payer TEXT NOT NULL,
  projected_12mo_micro NUMERIC NOT NULL DEFAULT 0,
  active_policy_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, payer)
);

-- Only rows with active subscriptions matter for the monitor.
CREATE INDEX idx_payer_projections_active
  ON payer_projections (chain_id) WHERE active_policy_count > 0;

-- ============================================================================
-- payer_email_verifications
-- ============================================================================
CREATE TABLE payer_email_verifications (
  token TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  payer TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payer_email_verif_lookup
  ON payer_email_verifications (chain_id, payer)
  WHERE consumed_at IS NULL;

-- ============================================================================
-- email_outbox
-- ============================================================================
--
-- status:         pending | sent | failed
-- attempts:       incremented on each delivery attempt (regardless of outcome).
-- next_attempt_at: earliest time the sender may pick this row up. Pending rows
--                  with a leased_until in the future are treated as claimed by
--                  a peer sender; the lease expires so a crashed sender never
--                  poisons the row.
-- dedupe_key:     application-supplied uniqueness key. Enqueue paths use
--                 `ON CONFLICT (dedupe_key) DO NOTHING` so re-running the same
--                 monitor tick after a crash cannot double-enqueue.
--                 Conventions:
--                   'low:<chainId>:<payer>:<stage>'
--                   'verify:<token>'
-- provider_message_id: Resend message id, recorded after successful send.
CREATE TABLE email_outbox (
  id SERIAL PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,
  to_address TEXT NOT NULL,
  template TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  leased_until TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- Partial index for the sender's poll: only pending rows whose lease
-- has expired (or never existed) and whose next_attempt_at is in the past.
CREATE INDEX idx_email_outbox_claimable
  ON email_outbox (next_attempt_at)
  WHERE status = 'pending';

-- ============================================================================
-- RLS
-- ============================================================================
-- All four tables are relayer-service-only. Enabling RLS with no policies
-- matches the pattern established in migration 012 (see idx_charges_unique_tx
-- and other service-scoped tables). The service role bypasses RLS.
ALTER TABLE payer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payer_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE payer_email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;
