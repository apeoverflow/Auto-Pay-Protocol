-- ============================================================
-- Points System
-- ============================================================

-- Widen charges.id from SERIAL (int4) to BIGINT for points_worker_state cursor
ALTER TABLE charges ALTER COLUMN id TYPE BIGINT;

-- ============================================================
-- Points Actions (config table — seeded at bottom)
-- ============================================================
CREATE TABLE points_actions (
  action_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  points INTEGER,
  points_per_usdc NUMERIC(10,2),
  category TEXT NOT NULL CHECK (category IN (
    'value', 'onboarding', 'subscription', 'social', 'streak', 'merchant', 'engagement'
  )),
  frequency TEXT NOT NULL CHECK (frequency IN (
    'once', 'per_occurrence', 'daily_cap', 'weekly_cap', 'once_per_policy', 'once_per_chain'
  )),
  frequency_cap INTEGER DEFAULT 1,
  cooldown_seconds INTEGER DEFAULT 0,
  source_type TEXT NOT NULL CHECK (source_type IN ('on-chain', 'off-chain', 'derived')),
  min_charge_amount TEXT DEFAULT '0',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (points IS NOT NULL AND points_per_usdc IS NULL) OR
    (points IS NULL AND points_per_usdc IS NOT NULL)
  )
);

-- ============================================================
-- Points Events (append-only ledger)
-- ============================================================
CREATE TABLE points_events (
  id BIGSERIAL PRIMARY KEY,
  action_id TEXT NOT NULL REFERENCES points_actions(action_id),
  wallet TEXT NOT NULL,
  points INTEGER NOT NULL,
  usdc_amount NUMERIC(20,6),
  chain_id INTEGER,
  source_type TEXT NOT NULL CHECK (source_type IN ('on-chain', 'off-chain', 'derived')),
  source_ref TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_points_events_wallet ON points_events(wallet);
CREATE INDEX idx_points_events_wallet_action ON points_events(wallet, action_id);
CREATE INDEX idx_points_events_wallet_created ON points_events(wallet, created_at DESC);

-- ============================================================
-- Points Balances (materialized per-wallet totals)
-- ============================================================
CREATE TABLE points_balances (
  wallet TEXT PRIMARY KEY,
  total_points BIGINT DEFAULT 0,
  total_usdc_volume NUMERIC(20,6) DEFAULT 0,
  monthly_points BIGINT DEFAULT 0,
  weekly_points BIGINT DEFAULT 0,
  month_key TEXT,
  week_key TEXT,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_checkin_date DATE,
  tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'diamond')),
  leaderboard_eligible BOOLEAN DEFAULT false,
  last_active_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_points_balances_total ON points_balances(total_points DESC)
  WHERE leaderboard_eligible = true;
CREATE INDEX idx_points_balances_monthly ON points_balances(monthly_points DESC)
  WHERE leaderboard_eligible = true;
CREATE INDEX idx_points_balances_weekly ON points_balances(weekly_points DESC)
  WHERE leaderboard_eligible = true;

-- ============================================================
-- Referrals
-- ============================================================
CREATE TABLE referrals (
  id SERIAL PRIMARY KEY,
  referrer TEXT NOT NULL,
  referred TEXT NOT NULL,
  referral_code TEXT NOT NULL,
  policy_id TEXT,
  chain_id INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  points_awarded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  UNIQUE(referred)
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer);
CREATE INDEX idx_referrals_code ON referrals(referral_code);

-- ============================================================
-- Referral Codes
-- ============================================================
CREATE TABLE referral_codes (
  wallet TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Points Worker State
-- ============================================================
CREATE TABLE points_worker_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_processed_charge_id BIGINT DEFAULT 0,
  last_processed_policy_created_at TIMESTAMPTZ DEFAULT '1970-01-01',
  last_processed_terms_at TIMESTAMPTZ DEFAULT '1970-01-01',
  last_loyalty_check_at TIMESTAMPTZ DEFAULT NOW(),
  last_run_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO points_worker_state (id) VALUES (1);

-- ============================================================
-- Seed action definitions
-- ============================================================

-- Value-based actions (points_per_usdc)
INSERT INTO points_actions (action_id, display_name, description, points_per_usdc, category, frequency, source_type, min_charge_amount) VALUES
  ('charge_value_payer', 'Payment Made', 'Earn points every time you are charged for a subscription', 10.00, 'value', 'per_occurrence', 'on-chain', '1000000'),
  ('charge_value_merchant', 'Revenue Earned', 'Earn points when subscribers pay on your plan', 10.00, 'value', 'per_occurrence', 'on-chain', '1000000'),
  ('referral_value', 'Referral Reward', 'Earn points when your referred user pays', 10.00, 'social', 'per_occurrence', 'on-chain', '1000000');

-- Flat milestone bonuses (points)
INSERT INTO points_actions (action_id, display_name, description, points, category, frequency, source_type) VALUES
  ('first_subscription', 'First Subscription', 'Create your first subscription', 100, 'subscription', 'once', 'on-chain'),
  ('subscription_5', '5th Subscription', 'Subscribe to 5 different merchants', 250, 'subscription', 'once', 'on-chain'),
  ('subscription_10', '10th Subscription', 'Subscribe to 10 different merchants', 500, 'subscription', 'once', 'on-chain'),
  ('loyalty_1m', '1-Month Loyalty', 'Maintain an active subscription for 1 month', 100, 'streak', 'once_per_policy', 'on-chain'),
  ('loyalty_3m', '3-Month Loyalty', 'Maintain an active subscription for 3 months', 250, 'streak', 'once_per_policy', 'on-chain'),
  ('loyalty_6m', '6-Month Loyalty', 'Maintain an active subscription for 6 months', 500, 'streak', 'once_per_policy', 'on-chain'),
  ('merchant_first_plan', 'First Plan', 'Create your first subscription plan', 100, 'merchant', 'once', 'on-chain'),
  ('merchant_first_subscriber', 'First Subscriber', 'Get your first paying subscriber', 200, 'merchant', 'once', 'on-chain'),
  ('merchant_10_subscribers', '10 Subscribers', 'Reach 10 active subscribers', 500, 'merchant', 'once', 'on-chain'),
  ('merchant_50_subscribers', '50 Subscribers', 'Reach 50 active subscribers', 1000, 'merchant', 'once', 'on-chain'),
  ('merchant_100_subscribers', '100 Subscribers', 'Reach 100 active subscribers', 2000, 'merchant', 'once', 'on-chain');

-- Social/engagement (flat, trivial)
INSERT INTO points_actions (action_id, display_name, description, points, category, frequency, cooldown_seconds, source_type) VALUES
  ('accept_terms', 'Accept Terms', 'Accept the Terms of Service', 5, 'onboarding', 'once', 0, 'on-chain'),
  ('follow_x', 'Follow on X', 'Follow @AutoPayProtocol on X', 2, 'social', 'once', 0, 'off-chain'),
  ('join_telegram', 'Join Telegram', 'Join the AutoPay Telegram group', 2, 'social', 'once', 0, 'off-chain'),
  ('share_x', 'Share on X', 'Share AutoPay on X', 1, 'social', 'daily_cap', 72000, 'off-chain'),
  ('daily_checkin', 'Daily Check-In', 'Visit the dashboard', 1, 'engagement', 'daily_cap', 72000, 'off-chain'),
  ('streak_7d', '7-Day Streak', 'Check in 7 consecutive days', 5, 'streak', 'weekly_cap', 0, 'derived'),
  ('streak_30d', '30-Day Streak', 'Check in 30 consecutive days', 15, 'streak', 'once_per_policy', 0, 'derived');
