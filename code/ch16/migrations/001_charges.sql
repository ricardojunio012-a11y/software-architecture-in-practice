-- Charges of every Morada community.
CREATE TABLE charges (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  community_id integer NOT NULL,
  unit text NOT NULL,
  due_date date NOT NULL,
  amount_cents integer NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'paid'))
);
