-- Schema for the chapter 37 lab, recreated on every run.
DROP SCHEMA IF EXISTS directory, events, vault, audit CASCADE;
CREATE SCHEMA directory;
CREATE SCHEMA events;
CREATE SCHEMA vault;
CREATE SCHEMA audit;

-- Residents. In the naive version, name, SSN, and email are in plain text; in the
-- crypto-shredding version, they are encrypted with the consumer's own key.
CREATE TABLE directory.residents (
  consumer integer PRIMARY KEY,
  unit     text NOT NULL,
  name     text NOT NULL,
  ssn      text NOT NULL,
  email    text NOT NULL
);

-- Charges: they stay after the resident moves out (legal obligation), tied to the
-- unit and a consumer number, with no readable personal data.
CREATE TABLE directory.charges (
  id           serial PRIMARY KEY,
  consumer     integer NOT NULL,
  unit         text NOT NULL,
  period       text NOT NULL,
  amount_cents integer NOT NULL,
  paid         boolean NOT NULL
);

-- Events already published to other modules (like a message topic): they are only
-- appended, never changed.
CREATE TABLE events.published (
  seq      serial PRIMARY KEY,
  consumer integer NOT NULL,
  type     text NOT NULL,
  time     text NOT NULL,
  data     jsonb NOT NULL
);

-- The key vault, one key per consumer, each one encrypted with the master key.
-- In production, it is a separate key service, with its own backup and retention.
CREATE TABLE vault.keys (
  consumer    integer PRIMARY KEY,
  wrapped_key text NOT NULL
);

-- Audit trail: each entry stores the hash of the previous one.
CREATE TABLE audit.trail (
  seq      integer PRIMARY KEY,
  time     text NOT NULL,
  actor    text NOT NULL,
  action   text NOT NULL,
  target   text NOT NULL,
  previous text NOT NULL,
  hash     text NOT NULL
);

-- Inserts only: updating, deleting, or truncating the trail is refused by the
-- database, even for the table owner.
CREATE FUNCTION audit.reject() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'the audit trail accepts only inserts';
END $$;
CREATE TRIGGER insert_only BEFORE UPDATE OR DELETE ON audit.trail
  FOR EACH ROW EXECUTE FUNCTION audit.reject();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON audit.trail
  FOR EACH STATEMENT EXECUTE FUNCTION audit.reject();

-- The application role: it reads and appends to the trail, and cannot change it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'morada_app') THEN
    CREATE ROLE morada_app LOGIN PASSWORD 'app';
  END IF;
END $$;
GRANT USAGE ON SCHEMA audit TO morada_app;
GRANT SELECT, INSERT ON audit.trail TO morada_app;
