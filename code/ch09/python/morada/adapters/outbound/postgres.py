# PostgreSQL outbound adapter: it fulfills the same port, keeping the bookings in a
# table. It is the only file that knows SQL and the database driver.
import psycopg

from morada.domain.schedule import Booking, NotFoundError, Schedule, Space


class PostgresSchedules:
    def __init__(self, db: psycopg.Connection, spaces: list[Space]):
        self._db = db
        self._spaces = {s.id: s for s in spaces}

    # Drops and recreates the table: the lab always starts from scratch
    def prepare(self) -> None:
        with self._db.transaction():
            self._db.execute("DROP TABLE IF EXISTS bookings")
            self._db.execute("""
                CREATE TABLE bookings (
                    id text PRIMARY KEY,
                    space text NOT NULL,
                    unit text NOT NULL,
                    date text NOT NULL,
                    start_hour integer NOT NULL,
                    end_hour integer NOT NULL,
                    fee_cents integer NOT NULL
                )""")

    def all(self) -> list[Schedule]:
        return [self.for_space(id) for id in self._spaces]

    def for_space(self, space: str) -> Schedule:
        if space not in self._spaces:
            raise NotFoundError("space not found")
        rows = self._db.execute(
            """SELECT id, unit, date, start_hour, end_hour, fee_cents FROM bookings
               WHERE space = %s ORDER BY date, start_hour""",
            (space,),
        ).fetchall()
        return Schedule(self._spaces[space], [Booking(*r) for r in rows])

    def for_booking(self, booking: str) -> Schedule:
        row = self._db.execute(
            "SELECT space FROM bookings WHERE id = %s", (booking,)
        ).fetchone()
        if row is None:
            raise NotFoundError("booking not found")
        return self.for_space(row[0])

    # Writes the schedule in one transaction: the aggregate is the unit of consistency
    def save(self, schedule: Schedule) -> None:
        with self._db.transaction():
            self._db.execute(
                "DELETE FROM bookings WHERE space = %s", (schedule.space.id,)
            )
            for b in schedule.bookings():
                self._db.execute(
                    "INSERT INTO bookings VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (
                        b.id,
                        schedule.space.id,
                        b.unit,
                        b.date,
                        b.start,
                        b.end,
                        b.fee_cents,
                    ),
                )
