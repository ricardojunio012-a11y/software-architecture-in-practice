-- The front desk entries, partitioned by month. Each partition is a real table; the
-- parent table only routes the rows to the right partition.
DROP TABLE IF EXISTS entries;
CREATE TABLE entries (
  community_id integer NOT NULL,
  entered_at timestamptz NOT NULL,
  plate text NOT NULL
) PARTITION BY RANGE (entered_at);

CREATE TABLE entries_2026_05 PARTITION OF entries
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE entries_2026_06 PARTITION OF entries
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE entries_2026_07 PARTITION OF entries
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE entries_2026_08 PARTITION OF entries
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE entries_2026_09 PARTITION OF entries
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE entries_2026_10 PARTITION OF entries
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE INDEX ON entries (community_id, entered_at);

-- One entry every 10 minutes, in 20 communities, from May to October
INSERT INTO entries
SELECT c, t, 'ABC' || lpad((c * 7)::text, 4, '0')
FROM generate_series(1, 20) AS c,
     generate_series('2026-05-01'::timestamptz, '2026-10-31 23:50', '10 minutes') AS t;
ANALYZE entries;
