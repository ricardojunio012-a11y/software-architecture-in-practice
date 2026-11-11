// Three ways of booking the grill area, from the way many systems start to the
// guarantee in the database.
import type pg from "pg";

export interface BookingRequest {
  resident: string;
  start: string;
  end: string;
}

const period = (r: BookingRequest) => `[${r.start}, ${r.end})`;

// Check, then insert: between the SELECT and the INSERT, another request can do the
// same
export async function bookNaive(db: pg.Client, r: BookingRequest): Promise<boolean> {
  const { rows } = await db.query(
    "SELECT 1 FROM naive_bookings WHERE space = 'grill-area' AND period && $1",
    [period(r)],
  );
  if (rows.length > 0) return false;
  await db.query(
    "INSERT INTO naive_bookings (space, resident, period) " +
      "VALUES ('grill-area', $1, $2)",
    [r.resident, period(r)],
  );
  return true;
}

// Optimistic locking: reads the schedule's version, checks and writes; the write counts
// only if the version is still the one it read. If someone else wrote first, it rolls
// back and rejects (or tries again)
export async function bookOptimistic(
  db: pg.Client,
  r: BookingRequest,
): Promise<boolean> {
  await db.query("BEGIN");
  try {
    const { rows: schedule } = await db.query(
      "SELECT version FROM schedules WHERE space = 'grill-area'",
    );
    const { rows: conflicts } = await db.query(
      "SELECT 1 FROM optimistic_bookings " +
        "WHERE space = 'grill-area' AND period && $1",
      [period(r)],
    );
    if (conflicts.length > 0) {
      await db.query("ROLLBACK");
      return false;
    }
    await db.query(
      "INSERT INTO optimistic_bookings (space, resident, period) " +
        "VALUES ('grill-area', $1, $2)",
      [r.resident, period(r)],
    );
    const { rowCount } = await db.query(
      "UPDATE schedules SET version = version + 1 " +
        "WHERE space = 'grill-area' AND version = $1",
      [schedule[0].version],
    );
    if (rowCount === 0) {
      await db.query("ROLLBACK"); // another booking changed the schedule after the read
      return false;
    }
    await db.query("COMMIT");
    return true;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

// Exclusion constraint: it only inserts; the database rejects the overlap with error
// 23P01. Simultaneous inserts that check each other can deadlock (40P01): the database
// rolls one of them back, and it tries again after a random pause that doubles at
// each attempt (up to 5 s), so that the retries do not keep deadlocking
export async function bookWithConstraint(
  db: pg.Client,
  r: BookingRequest,
): Promise<boolean> {
  for (let attempt = 1; ; attempt++) {
    try {
      await db.query(
        "INSERT INTO bookings (space, resident, period) " +
          "VALUES ('grill-area', $1, $2)",
        [r.resident, period(r)],
      );
      return true;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "23P01") return false;
      if (code !== "40P01") throw error;
      const pause = Math.random() * Math.min(5000, 25 * 2 ** attempt);
      await new Promise((done) => setTimeout(done, pause));
    }
  }
}
