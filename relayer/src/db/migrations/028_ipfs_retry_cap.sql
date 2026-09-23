-- Migration 028: Give the IPFS retry worker a failure cap
--
-- Before this change, `runIpfsRetryOnce` scanned every active plan with
-- ipfs_cid=NULL every tick. A plan whose metadata was permanently
-- un-pinnable (payload too large, malformed content, exhausted quota)
-- would be re-attempted every 5 min forever — spamming Pinata, filling
-- logs with warnings that mask real issues, and potentially exhausting
-- rate limits and starving good plans.
--
-- We add:
--   ipfs_upload_attempts INT      — running count of upload attempts
--   ipfs_last_error      TEXT     — most recent error (truncated), for ops
--   ipfs_next_attempt_at TIMESTAMPTZ — earliest time to retry (backoff)
--
-- The worker gates on ipfs_next_attempt_at <= NOW() and skips rows whose
-- attempts have exceeded IPFS_MAX_UPLOAD_ATTEMPTS. Successful upload
-- (setPlanIpfsCid) resets attempts to 0 and clears the error, so a plan
-- can recover if the merchant later updates its content via PATCH.

ALTER TABLE plan_metadata
  ADD COLUMN ipfs_upload_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN ipfs_last_error TEXT,
  ADD COLUMN ipfs_next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Retry worker's candidate SELECT: active AND unpinned AND due AND
-- under the attempts cap. The partial index makes this a trivial range
-- scan even with thousands of active plans.
CREATE INDEX idx_plan_metadata_ipfs_retry
  ON plan_metadata (ipfs_next_attempt_at, ipfs_upload_attempts)
  WHERE status = 'active' AND ipfs_cid IS NULL;
