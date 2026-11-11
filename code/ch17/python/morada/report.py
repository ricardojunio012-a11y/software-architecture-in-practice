# The board president's delinquency report, with the defect the chapter uses to show
# the leak: the query forgot the community filter.
import psycopg


def delinquents(db: psycopg.Connection) -> list[tuple]:
    return db.execute("""SELECT community_id, unit, resident, amount_cents
           FROM charges
           WHERE status = 'open' -- missing: AND community_id = %s
           ORDER BY community_id, unit""").fetchall()
