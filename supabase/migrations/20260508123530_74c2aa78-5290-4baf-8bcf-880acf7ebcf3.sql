CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.dr_config (
  id boolean PRIMARY KEY DEFAULT true,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dr_config_singleton CHECK (id = true)
);

ALTER TABLE private.dr_config ENABLE ROW LEVEL SECURITY;
-- No policies → only service-role / postgres can read or write. Authenticated and anon users are blocked.

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.dr_config FROM PUBLIC, anon, authenticated;