-- Past-due, unpaid charges of community 1234, by unit.
SELECT unit, count(*) AS charges, sum(amount_cents) AS total_cents
FROM charges
WHERE community_id = 1234 AND status = 'open' AND due_date < DATE '2026-10-01'
GROUP BY unit
ORDER BY unit
