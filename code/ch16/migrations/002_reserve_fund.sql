-- Each community's reserve fund. The balance is the sum of the entries, which are never
-- changed: a withdrawal is a negative entry.
CREATE TABLE funds (
  id integer PRIMARY KEY,
  community_id integer NOT NULL
);

CREATE TABLE entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fund_id integer NOT NULL REFERENCES funds,
  amount_cents integer NOT NULL,
  description text NOT NULL
);
