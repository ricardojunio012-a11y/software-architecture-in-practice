-- One table shared by every community, separated by the community_id column.
-- Runs as the database administrator.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- The application role: it neither owns the tables nor is a superuser, so the RLS
-- policies apply to it
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_morada') THEN
    CREATE ROLE app_morada LOGIN PASSWORD 'app_morada';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA public TO app_morada;

CREATE TABLE charges (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  community_id integer NOT NULL,
  unit text NOT NULL,
  resident text NOT NULL,
  amount_cents integer NOT NULL,
  status text NOT NULL
);
GRANT SELECT, INSERT ON charges TO app_morada;

INSERT INTO charges (community_id, unit, resident, amount_cents, status) VALUES
  (12, '101', 'Anna Reed', 45000, 'open'),
  (12, '102', 'Brian Lewis', 45000, 'paid'),
  (12, '204', 'Carol Nash', 52000, 'open'),
  (15, '11', 'Derek Rhodes', 38000, 'open'),
  (15, '12', 'Ellen Parker', 38000, 'open'),
  (20, 'A-3', 'Frank Cole', 61000, 'open'),
  (20, 'A-4', 'Gina Allen', 61000, 'paid');

-- Which management company manages each community. A management company has many
-- communities, and the link changes with the contracts: that is why it lives in a
-- table, not in the code
CREATE TABLE managed_communities (
  management_company_id integer NOT NULL,
  community_id integer NOT NULL,
  PRIMARY KEY (management_company_id, community_id)
);
GRANT SELECT ON managed_communities TO app_morada;

INSERT INTO managed_communities (management_company_id, community_id) VALUES
  (3, 12),
  (3, 15),
  (4, 20);
