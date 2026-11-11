-- Three booking tables, one for each way of protecting the grill area, and the
-- payment tables with an idempotency key.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
CREATE EXTENSION btree_gist;

-- 1. No protection at all in the database: the application checks before inserting
CREATE TABLE naive_bookings (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  space text NOT NULL,
  resident text NOT NULL,
  period tstzrange NOT NULL
);

-- 2. Optimistic locking: the space's schedule has a version, and only whoever read the
-- current one writes
CREATE TABLE schedules (space text PRIMARY KEY, version integer NOT NULL);
INSERT INTO schedules VALUES ('grill-area', 1);
CREATE TABLE optimistic_bookings (LIKE naive_bookings INCLUDING ALL);

-- 3. Exclusion constraint: the database rejects two overlapping periods for the same
-- space, wherever the insert comes from
CREATE TABLE bookings (
  LIKE naive_bookings INCLUDING ALL,
  EXCLUDE USING gist (space WITH =, period WITH &&)
);

-- The payment: the idempotency key is stored in the same transaction as the payment
CREATE TABLE payments (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  charge text NOT NULL,
  amount_cents integer NOT NULL
);
CREATE TABLE idempotency_keys (
  key text PRIMARY KEY,
  payment_id integer REFERENCES payments
);
