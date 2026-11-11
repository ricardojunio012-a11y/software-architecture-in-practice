-- The task queue and the invoices. The queue is an ordinary table: each worker claims
-- the next pending task with FOR UPDATE SKIP LOCKED, and a task claimed too long ago
-- without finishing becomes available again (the worker that claimed it died).
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

CREATE TABLE communities (id integer PRIMARY KEY, units integer NOT NULL);
INSERT INTO communities
SELECT c, 20 + (c * 37) % 181 FROM generate_series(1, 3000) AS c;

CREATE TABLE tasks (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL,          -- 'monthly' or 'reissue'
  community_id integer NOT NULL,
  priority integer NOT NULL,   -- lower comes first
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  claimed_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX ON tasks (priority, id) WHERE status <> 'done';

-- Uniqueness makes generation idempotent: redoing a task does not duplicate invoices
CREATE TABLE invoices (
  community_id integer NOT NULL,
  unit integer NOT NULL,
  period text NOT NULL,
  PRIMARY KEY (community_id, unit, period)
);
