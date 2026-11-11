// The "replica" version: the resident pays the charge, and the read on the delayed
// replica still shows "open". The fix is reading your own writes: after a write, the
// application reads from the replica only when it has already applied the write;
// otherwise, it reads from the primary.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const data = process.argv[2];
const primary = new pg.Client({ connectionString: process.env.PRIMARY_URL });
const replica = new pg.Client({ connectionString: process.env.REPLICA_URL });
await Promise.all([primary.connect(), replica.connect()]);
const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

async function status(db: pg.Client) {
  try {
    const { rows } = await db.query("SELECT status FROM charges WHERE id = 'C-1'");
    return rows[0]?.status ?? "(no charge)";
  } catch (error) {
    // On a second run, the delayed replica may apply the DROP of the old table between
    // two reads: for a reader expecting the new charge, that is the same as no charge
    if ((error as { code?: string }).code === "42P01") return "(no charge)";
    throw error;
  }
}

// Read your writes: the replica serves if it has applied the write's log position (LSN)
async function readAfterWrite(lsn: string) {
  for (let i = 0; i < 5; i++) {
    const { rows } = await replica.query(
      "SELECT pg_last_wal_replay_lsn() >= $1::pg_lsn AS caught_up",
      [lsn],
    );
    if (rows[0].caught_up) return `${await status(replica)} (read on the replica)`;
    await wait(100);
  }
  return `${await status(primary)} (replica behind; read on the primary)`;
}

// Setup: an open charge, already copied to the replica
await primary.query("DROP TABLE IF EXISTS charges");
await primary.query("CREATE TABLE charges (id text PRIMARY KEY, status text)");
await primary.query("INSERT INTO charges VALUES ('C-1', 'open')");
while (
  (await replica.query("SELECT to_regclass('charges') AS t")).rows[0].t === null ||
  (await status(replica)) !== "open"
) {
  await wait(200);
}

const lines = ["before the payment, on the replica: open"];
await primary.query("UPDATE charges SET status = 'paid' WHERE id = 'C-1'");
const { rows } = await primary.query("SELECT pg_current_wal_lsn() AS lsn");
const lsn = rows[0].lsn;
lines.push(
  "the resident pays (written to the primary)",
  `right after, reading on the replica: ${await status(replica)}`,
  `right after, reading on the primary: ${await status(primary)}`,
  `right after, reading your own write: ${await readAfterWrite(lsn)}`,
);
// Waits for the replica to catch up with the primary and reads again
while ((await status(replica)) !== "paid") await wait(200);
lines.push(`after the replica caught up: ${await readAfterWrite(lsn)}`);

await Promise.all([primary.end(), replica.end()]);
const output = path.join(data, "output", "replica");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
