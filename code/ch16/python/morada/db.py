# Connection to PostgreSQL and a clean schema for each experiment.
import psycopg


def connect(url: str) -> psycopg.Connection:
    # No automatic transaction: each piece of code opens and closes its own with BEGIN
    # and COMMIT
    return psycopg.connect(url, autocommit=True)


def reset_schema(db: psycopg.Connection) -> None:
    db.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
