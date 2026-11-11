-- 2,000 communities, 50 units each, 10 months of charges: 1 million rows.
-- About one charge in every 23 is open.
INSERT INTO charges (community_id, unit, due_date, amount_cents, status)
SELECT c, lpad(u::text, 3, '0'), make_date(2026, m, 10), 40000 + (u % 7) * 2500,
       CASE WHEN (c + u + m) % 23 = 0 THEN 'open' ELSE 'paid' END
FROM generate_series(1, 2000) AS c,
     generate_series(1, 50) AS u,
     generate_series(1, 10) AS m;
