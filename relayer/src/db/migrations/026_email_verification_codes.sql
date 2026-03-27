-- Email verification codes for merchant registration (sent via Resend)
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verification_codes_email ON email_verification_codes(email, used);

ALTER TABLE email_verification_codes ENABLE ROW LEVEL SECURITY;
-- No anon access — all operations go through the relayer API
