-- 20 communities with 120 units each and one year of charges, generated
-- deterministically. The column the route uses is indexed: each query is fast, and the
-- problem in this lab is the number of queries, not any single one.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

CREATE TABLE units (
  id integer PRIMARY KEY,
  community_id integer NOT NULL,
  code text NOT NULL
);
CREATE INDEX ON units (community_id);

CREATE TABLE charges (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  unit_id integer NOT NULL REFERENCES units,
  due_date date NOT NULL,
  amount_cents integer NOT NULL,
  status text NOT NULL
);
CREATE INDEX ON charges (unit_id);

INSERT INTO units
SELECT (c - 1) * 120 + u, c, 'U-' || lpad(u::text, 3, '0')
FROM generate_series(1, 20) AS c, generate_series(1, 120) AS u;

INSERT INTO charges (unit_id, due_date, amount_cents, status)
SELECT
  id,
  make_date(2026, month, 5),
  40000 + (id % 7) * 1000,
  CASE WHEN (id * 13 + month * 7) % 100 < 6 THEN 'open' ELSE 'paid' END
FROM units, generate_series(1, 12) AS month;

ANALYZE;
