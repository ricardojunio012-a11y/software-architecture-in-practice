# Notice repository in PostgreSQL. The primary key guarantees, in the database,
# that the same notice is not saved twice.
import psycopg


class PostgresNotices:
    def __init__(self, db: psycopg.Connection):
        self._db = db

    @staticmethod
    def connect(url: str) -> "PostgresNotices":
        db = psycopg.connect(url, autocommit=True)
        db.execute("DROP TABLE IF EXISTS notices")
        db.execute("CREATE TABLE notices (id text PRIMARY KEY, text text NOT NULL)")
        return PostgresNotices(db)

    def already_sent(self, id: str) -> bool:
        row = self._db.execute("SELECT 1 FROM notices WHERE id = %s", (id,))
        return row.fetchone() is not None

    def record(self, id: str, text: str) -> None:
        self._db.execute("INSERT INTO notices VALUES (%s, %s)", (id, text))

    def close(self) -> None:
        self._db.close()
