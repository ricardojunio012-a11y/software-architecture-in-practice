# Versioned migrations: each file in migrations/ runs only once, in order, and is
# recorded in the applied_migrations table. A file that starts with
# "-- no transaction" runs outside a transaction (CREATE INDEX CONCURRENTLY needs it).
import math
from pathlib import Path

import psycopg


def apply_migrations(
    db: psycopg.Connection, folder: str, up_to: float = math.inf
) -> list[str]:
    db.execute("""CREATE TABLE IF NOT EXISTS applied_migrations (
             version text PRIMARY KEY,
             applied_at timestamptz NOT NULL DEFAULT now()
           )""")
    done = {v for (v,) in db.execute("SELECT version FROM applied_migrations")}
    applied = []
    record = "INSERT INTO applied_migrations (version) VALUES (%s)"
    for file in sorted(p.name for p in Path(folder).glob("*.sql")):
        if int(file.split("_")[0]) > up_to:
            break
        if file in done:
            continue
        sql = (Path(folder) / file).read_text(encoding="utf-8")
        if sql.startswith("-- no transaction"):
            db.execute(sql)
            db.execute(record, [file])
        else:
            # The migration and its record go in together, or neither does
            with db.transaction():
                db.execute(sql)
                db.execute(record, [file])
        applied.append(file)
    return applied
