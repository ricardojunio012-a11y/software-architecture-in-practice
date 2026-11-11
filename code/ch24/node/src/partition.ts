// The "partition" version: a query for one month reads only that month's partition, and
// deleting an old month means removing a partition, not deleting row by row.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const data = process.argv[2];
const db = new pg.Client({ connectionString: process.env.PRIMARY_URL });
await db.connect();
await db.query(fs.readFileSync(path.join(data, "sql", "entries.sql"), "utf8"));

// The partitions that show up in the execution plan
async function partitionsRead(query: string) {
  const { rows } = await db.query(`EXPLAIN (COSTS OFF) ${query}`);
  const plan = rows.map((r) => r["QUERY PLAN"]).join("\n");
  return [...new Set(plan.match(/entries_\d{4}_\d{2}/g))].sort();
}
const count = async (sql: string) => Number((await db.query(sql)).rows[0].n);
const fmt = (n: number) => n.toLocaleString("en-US");

const lines = [
  `entries in the table: ${fmt(await count("SELECT count(*) AS n FROM entries"))}`,
];
const october =
  "SELECT count(*) FROM entries WHERE community_id = 12 " +
  "AND entered_at >= '2026-10-01' AND entered_at < '2026-11-01'";
lines.push(
  `entries for community 12 in October: partitions read: ` +
    (await partitionsRead(october)).join(", "),
);
const noDate = "SELECT count(*) FROM entries WHERE community_id = 12";
const readNoDate = (await partitionsRead(noDate)).length;
lines.push(`entries for community 12, no date filter: ${readNoDate} partitions read`);

// Retention: the oldest month goes away whole, in a command that does not scan the rows
const may = await count("SELECT count(*) AS n FROM entries_2026_05");
await db.query("ALTER TABLE entries DETACH PARTITION entries_2026_05");
await db.query("DROP TABLE entries_2026_05");
lines.push(
  `retention: May removed with DROP of the partition (${fmt(may)} rows)`,
  `entries in the table: ${fmt(await count("SELECT count(*) AS n FROM entries"))}`,
);

await db.end();
const output = path.join(data, "output", "partition");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
