# The API's database: communities, charges, payments and idempotency keys. The
# primary key of the keys table, (management_company, key), guarantees a single
# processing per key of each client, even with simultaneous requests.
import json
from pathlib import Path

import psycopg

TABLES = """
    DROP TABLE IF EXISTS idempotency_keys, payments, charges, communities;
    DROP SEQUENCE IF EXISTS payments_seq;
    CREATE TABLE communities (id text PRIMARY KEY, management_company text NOT NULL);
    CREATE TABLE charges (
      id text PRIMARY KEY,
      community text NOT NULL REFERENCES communities,
      unit text NOT NULL,
      due_date date NOT NULL,
      amount_cents integer NOT NULL,
      status text NOT NULL
    );
    CREATE TABLE payments (
      id text PRIMARY KEY,
      charge text NOT NULL UNIQUE REFERENCES charges,
      amount_cents integer NOT NULL
    );
    CREATE SEQUENCE payments_seq;
    CREATE TABLE idempotency_keys (
      management_company text,
      key text,
      request text NOT NULL,
      status integer,
      response text,
      PRIMARY KEY (management_company, key)
    )"""


def read_json(file: Path):
    return json.loads(file.read_text("utf-8"))


def prepare_database(url: str, charges_file: str) -> None:
    with psycopg.connect(url, autocommit=True) as db:
        db.execute(TABLES)
        # Who manages each community is in communities.json, next to the charges
        folder = Path(charges_file).parent
        for c in read_json(folder / "communities.json"):
            db.execute(
                "INSERT INTO communities VALUES (%s, %s)",
                [c["id"], c["managementCompany"]],
            )
        for c in read_json(Path(charges_file)):
            db.execute(
                "INSERT INTO charges VALUES (%s, %s, %s, %s, %s, %s)",
                [
                    c["id"],
                    c["community"],
                    c["unit"],
                    c["dueDate"],
                    c["amountCents"],
                    c["status"],
                ],
            )
