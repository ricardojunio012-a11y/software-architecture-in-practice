-- A community's charges and the heavy billing dashboard query. The pg_sleep
-- mimics a 200 ms query over millions of rows, without needing millions of rows in
-- the lab.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

CREATE TABLE charges (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  community_id integer NOT NULL,
  amount_cents integer NOT NULL,
  status text NOT NULL
);

INSERT INTO charges (community_id, amount_cents, status)
SELECT 12, 45000, CASE WHEN n % 10 = 0 THEN 'open' ELSE 'paid' END
FROM generate_series(1, 120) AS n;

CREATE FUNCTION billing_dashboard(comm integer)
RETURNS TABLE (received_cents bigint, outstanding_cents bigint)
LANGUAGE sql AS $$
  SELECT
    (SELECT sum(amount_cents) FROM charges, pg_sleep(0.2)
      WHERE community_id = comm AND status = 'paid'),
    (SELECT sum(amount_cents) FROM charges
      WHERE community_id = comm AND status = 'open')
$$;
