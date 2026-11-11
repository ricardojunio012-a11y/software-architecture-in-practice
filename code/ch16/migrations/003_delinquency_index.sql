-- no transaction
-- Index for the delinquency query: the columns compared for equality first, the one
-- compared by range last. CONCURRENTLY builds the index without blocking writes to
-- the table, but it cannot run inside a transaction.
CREATE INDEX CONCURRENTLY charges_delinquency
  ON charges (community_id, status, due_date);
