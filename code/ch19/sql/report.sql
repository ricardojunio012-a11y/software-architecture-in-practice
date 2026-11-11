-- Delinquency by region and size: the share of the amount of charges due that is still
-- open. A query that, in the transactional database, would join four tables and scan
-- every charge of every community.
SELECT
  d.region,
  d.size,
  count(*)::INTEGER AS charges,
  count(*) FILTER (WHERE f.is_open)::INTEGER AS open_charges,
  round(100.0 * sum(f.amount_cents) FILTER (WHERE f.is_open)
        / sum(f.amount_cents), 1)::DOUBLE AS delinquency
FROM fact_charge f
JOIN dim_community d USING (community_id)
GROUP BY d.region, d.size
ORDER BY d.region, CASE d.size WHEN 'small' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
