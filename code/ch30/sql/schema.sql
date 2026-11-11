-- Each service has its own schema and touches only that one; in the real world, they
-- would be separate databases. No transaction spans two schemas.
DROP SCHEMA IF EXISTS contracts, billing, platform, directory, notifications, orchestrator
  CASCADE;

CREATE SCHEMA contracts;
CREATE TABLE contracts.contracts (
  saga text PRIMARY KEY,
  community text NOT NULL,
  status text NOT NULL, -- signed | canceled
  reason text
);

-- Ledger entries, never deleted: the compensation of a charge is a reversal
CREATE SCHEMA billing;
CREATE TABLE billing.entries (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text UNIQUE NOT NULL, -- idempotency: saga and step
  community text NOT NULL,
  kind text NOT NULL, -- charge | reversal
  amount_cents integer NOT NULL
);

CREATE SCHEMA platform;
CREATE TABLE platform.tenants (
  saga text PRIMARY KEY,
  community text NOT NULL,
  status text NOT NULL -- active | deactivated
);

CREATE SCHEMA directory;
CREATE TABLE directory.residents (
  saga text NOT NULL,
  name text NOT NULL,
  tax_id text NOT NULL,
  unit text NOT NULL
);

CREATE SCHEMA notifications;
CREATE TABLE notifications.sent (
  key text PRIMARY KEY,
  community text NOT NULL,
  recipients integer NOT NULL
);

-- The saga's state, saved at every step: it is what makes resuming after a crash possible
CREATE SCHEMA orchestrator;
CREATE TABLE orchestrator.sagas (
  id text PRIMARY KEY,
  -- running | compensating | completed | compensated | halted (waits for a person)
  status text NOT NULL,
  completed integer NOT NULL DEFAULT 0,
  reason text -- why the saga is compensating or halted
);
CREATE TABLE orchestrator.history (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  saga text NOT NULL,
  message text NOT NULL
);
