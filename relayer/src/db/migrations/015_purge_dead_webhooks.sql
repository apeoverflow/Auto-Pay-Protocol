-- Purge permanently failed webhooks older than 7 days.
-- These are terminal (max retries exhausted) and just pollute the health check.
DELETE FROM webhooks
WHERE status = 'failed'
  AND last_attempt_at < NOW() - INTERVAL '7 days';
