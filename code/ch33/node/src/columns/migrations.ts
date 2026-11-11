// The schema migrations. Each one limits the wait for the lock: if the table is busy,
// it gives up after 2 seconds instead of queuing all the traffic behind it
// (chapter 16).
import type pg from "pg";

export async function migrate(db: pg.Client, sql: string): Promise<void> {
  await db.query("BEGIN");
  await db.query("SET LOCAL lock_timeout = '2s'");
  await db.query(sql);
  await db.query("COMMIT");
}

// Copies the old data into the new column in small batches, each batch in its own
// transaction, so the whole table is not locked. The condition compares the two
// columns, not just "phone IS NULL": a row that v2 wrote and v1 changed afterward has
// a phone filled in, but out of date.
export async function copyInBatches(db: pg.Client, size = 250) {
  let rows = 0;
  let batches = 0;
  for (;;) {
    const r = await db.query(
      `UPDATE residents SET phone = mobile
        WHERE id IN (SELECT id FROM residents
                      WHERE phone IS DISTINCT FROM mobile
                      ORDER BY id LIMIT $1)`,
      [size],
    );
    if (!r.rowCount) return { rows, batches };
    rows += r.rowCount;
    batches++;
  }
}
