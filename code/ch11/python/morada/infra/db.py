# The Billing database: the payments and, in the outbox version, the table of events
# to publish, saved in the same transaction as the payment.
import json
import os

import psycopg


def connect_db() -> psycopg.Connection:
    db = psycopg.connect(os.environ["DATABASE_URL"], autocommit=True)
    db.execute("DROP TABLE IF EXISTS outbox, payments")
    db.execute("""CREATE TABLE payments (
        id text PRIMARY KEY, unit text, booking text, amount_cents integer)""")
    db.execute("""CREATE TABLE outbox (
        id serial PRIMARY KEY, event text UNIQUE, payload text,
        published boolean NOT NULL DEFAULT false)""")
    return db


def save_payment(db: psycopg.Connection, p: dict) -> None:
    db.execute(
        "INSERT INTO payments VALUES (%s, %s, %s, %s)",
        (p["payment"], p["unit"], p["booking"], p["amountCents"]),
    )


# Payment and event in the same transaction: either both are saved, or neither is
def save_with_outbox(db: psycopg.Connection, p: dict, e: dict) -> None:
    with db.transaction():
        save_payment(db, p)
        db.execute(
            "INSERT INTO outbox (event, payload) VALUES (%s, %s)",
            (e["event"], json.dumps(e, ensure_ascii=False)),
        )
