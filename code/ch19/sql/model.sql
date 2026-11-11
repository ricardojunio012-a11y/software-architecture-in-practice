-- Load and transformation (the L and the T of ELT), in DuckDB. The files in the raw zone
-- become raw tables, and the dimensional model is built from them with SQL.
CREATE TABLE raw_communities AS SELECT * FROM read_csv('{raw}/communities.csv');
CREATE TABLE raw_residents AS SELECT * FROM read_csv('{raw}/residents.csv');
CREATE TABLE raw_vehicles AS SELECT * FROM read_csv('{raw}/vehicles.csv');
CREATE TABLE raw_charges AS SELECT * FROM read_csv('{raw}/charges.csv');
CREATE TABLE states AS SELECT * FROM read_csv('{input}/states.csv');

-- Dimension: the community with the attributes used for grouping, including the ones
-- that do not exist at the source (region, from the state; size, from the unit count)
CREATE TABLE dim_community AS
SELECT
  c.id AS community_id,
  c.state,
  s.region,
  CASE WHEN c.units < 60 THEN 'small'
       WHEN c.units < 150 THEN 'medium'
       ELSE 'large' END AS size,
  c.units
FROM raw_communities c
LEFT JOIN states s USING (state);

CREATE TABLE dim_resident AS
SELECT id AS resident_id, community_id, tax_id_pseudonym FROM raw_residents;

CREATE TABLE dim_vehicle AS
SELECT plate_pseudonym, resident_id FROM raw_vehicles;

-- Rows that break the rules stay out of the fact: they go to quarantine, with the reason
CREATE TABLE quarantine_charges AS
SELECT *, 'non-positive amount' AS reason
FROM raw_charges
WHERE amount_cents <= 0;

-- Fact: one row per charge, with the measures and the dimension keys
CREATE TABLE fact_charge AS
SELECT
  id AS charge_id,
  community_id,
  resident_id,
  strftime(due_date, '%Y-%m') AS month,
  amount_cents,
  status = 'open' AS is_open
FROM raw_charges
WHERE amount_cents > 0;
