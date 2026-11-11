-- Morada's transactional database, with fictional data generated deterministically:
-- 40 communities, one resident per unit, one vehicle for every three residents, and six
-- months of charges. Tax IDs and plates have the right format but belong to no one.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

CREATE TABLE communities (
  id integer PRIMARY KEY,
  name text NOT NULL,
  state char(2) NOT NULL,
  units integer NOT NULL
);

CREATE TABLE residents (
  id integer PRIMARY KEY,
  community_id integer NOT NULL REFERENCES communities,
  name text NOT NULL,
  tax_id char(9) NOT NULL
);

CREATE TABLE vehicles (
  plate char(7) PRIMARY KEY,
  resident_id integer NOT NULL REFERENCES residents
);

CREATE TABLE charges (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  community_id integer NOT NULL REFERENCES communities,
  resident_id integer NOT NULL REFERENCES residents,
  due_date date NOT NULL,
  amount_cents integer NOT NULL,
  status text NOT NULL
);

INSERT INTO communities
SELECT
  c,
  'Community ' || c,
  (ARRAY['TX','AZ','NM','CA','WA','NY','MA','PA','IL','OH','FL','GA'])[1 + c % 12],
  20 + (c * 37) % 230
FROM generate_series(1, 40) AS c;

-- One resident per unit, numbered in sequence
INSERT INTO residents
SELECT
  row_number() OVER (ORDER BY c.id, u),
  c.id,
  'Resident ' || c.id || '-' || u,
  lpad(((c.id * 100000 + u)::bigint * 7919 % 999999999)::text, 9, '0')
FROM communities c, generate_series(1, c.units) AS u;

-- Plates in the 1ABC234 format: a digit, three letters, three digits
INSERT INTO vehicles
SELECT
  (r.id % 10) || chr(65 + r.id % 26) || chr(65 + (r.id / 26) % 26)
    || chr(65 + (r.id / 676) % 26) || lpad(((r.id / 7) % 1000)::text, 3, '0'),
  r.id
FROM residents r
WHERE r.id % 3 = 0;

-- Six months of charges. Delinquency varies by community, from 4% to 22%
INSERT INTO charges (community_id, resident_id, due_date, amount_cents, status)
SELECT
  r.community_id,
  r.id,
  make_date(2026, month, 10),
  30000 + r.community_id * 1000,
  CASE WHEN (r.id * 31 + month * 17) % 100 < 4 + (r.community_id * 7) % 19
    THEN 'open' ELSE 'paid' END
FROM residents r, generate_series(4, 9) AS month;

-- A defect at the source: an import wrote three charges with a zero amount
UPDATE charges SET amount_cents = 0 WHERE id IN (101, 2002, 20003);
