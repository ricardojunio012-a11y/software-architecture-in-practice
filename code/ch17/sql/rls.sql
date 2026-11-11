-- Row-Level Security: the database filters the rows of every query by the
-- transaction's community, set by the application in app.community. With no
-- community set, the comparison yields null and no row passes. The NULLIF handles
-- the empty value the setting takes after a transaction with SET LOCAL ends.
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY community_isolation ON charges
  USING (
    community_id = NULLIF(current_setting('app.community', true), '')::integer
  )
  WITH CHECK (
    community_id = NULLIF(current_setting('app.community', true), '')::integer
  );

-- The management company sees the communities it manages. Both policies are
-- permissive, and the database accepts a row that passes either of them. The list
-- of communities comes from the managed_communities table, not from the
-- application: the application only says who the management company is, in
-- app.management_company.
CREATE POLICY management_company_access ON charges
  USING (
    community_id IN (
      SELECT community_id FROM managed_communities
      WHERE management_company_id =
        NULLIF(current_setting('app.management_company', true), '')::integer
    )
  )
  WITH CHECK (
    community_id IN (
      SELECT community_id FROM managed_communities
      WHERE management_company_id =
        NULLIF(current_setting('app.management_company', true), '')::integer
    )
  );
