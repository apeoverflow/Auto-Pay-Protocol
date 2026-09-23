-- Migration 029: opt_out_token DEFAULT via pgcrypto
--
-- Previously upsertPayerEmail generated a random 64-hex token in JS on
-- EVERY call (checkout, email edit, re-verify) and threw it away
-- whenever the row already existed — since the DO UPDATE branch never
-- rotates the token. Trivial waste (a few bytes of crypto randomness)
-- but easy to eliminate by pushing the generation into the DB with a
-- DEFAULT clause. Postgres then only generates a token when actually
-- inserting.
--
-- Requires the pgcrypto extension. Supabase enables it by default;
-- self-hosted operators may need to `CREATE EXTENSION IF NOT EXISTS
-- pgcrypto;` before running migrations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE payer_contacts
  ALTER COLUMN opt_out_token SET DEFAULT encode(gen_random_bytes(32), 'hex');
