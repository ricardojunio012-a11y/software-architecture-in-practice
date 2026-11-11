// Renaming the mobile column to phone with the application live. During each
// deployment, the old version and the new one serve together, against the same
// PostgreSQL.
//   rename:   the migration and the new code go out in the same deployment
//   expand:   three deployments (expand, migrate, contract)
//   shortcut: the three deployments, but copying the data before v1 is gone
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { generator } from "../random.ts";
import { copyInBatches, migrate } from "./migrations.ts";
import { Instance } from "./versions.ts";

const scenario = process.argv[3];
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const lines: string[] = [];
const expected = new Map<number, string>(); // the last phone written successfully
const draw = generator(16);
let totalErrors = 0;
let totalWrong = 0;

const phone = () => {
  const n = String(Math.floor(draw() * 1e7)).padStart(7, "0");
  return `+1 555-${n.slice(0, 3)}-${n.slice(3)}`;
};

async function recreateTable() {
  await db.query("DROP TABLE IF EXISTS residents");
  await db.query(`CREATE TABLE residents (
    id serial PRIMARY KEY, name text NOT NULL, mobile text)`);
  expected.clear();
  for (let i = 1; i <= 1_000; i++) {
    const tel = phone();
    await db.query("INSERT INTO residents (name, mobile) VALUES ($1, $2)", [
      `Resident ${i}`,
      tel,
    ]);
    expected.set(i, tel);
  }
}

// 200 operations, spread round-robin across the instances that are live:
// 60% reads, 30% phone changes, and 10% new residents
async function traffic(label: string, versions: string[]) {
  const instances = await Promise.all(versions.map((v) => Instance.start(v)));
  let errors = 0;
  let wrong = 0;
  let firstError = "";
  for (let i = 0; i < 200; i++) {
    const instance = instances[i % instances.length];
    const operation = draw();
    const ids = [...expected.keys()];
    const id = ids[Math.floor(draw() * ids.length)];
    const tel = phone();
    try {
      if (operation < 0.6) {
        if ((await instance.read(id)) !== expected.get(id)) wrong++;
      } else if (operation < 0.9) {
        await instance.change(id, tel);
        expected.set(id, tel);
      } else {
        expected.set(await instance.register(`New resident ${i}`, tel), tel);
      }
    } catch (error) {
      errors++;
      firstError ||= (error as Error).message;
    }
  }
  await Promise.all(instances.map((i) => i.stop()));
  totalErrors += errors;
  totalWrong += wrong;
  const count = `${errors} errors, ${wrong} wrong reads`;
  lines.push(`  ${label.padEnd(38)}200 operations: ${count}`);
  if (firstError) lines.push(`    error: ${firstError}`);
}

async function migration(sql: string) {
  await migrate(db, sql);
  lines.push(`  migration: ${sql}`);
}

async function copy() {
  const r = await copyInBatches(db);
  lines.push(`  copy in batches of 250: ${r.rows} rows in ${r.batches} batches`);
}

const ADD = "ALTER TABLE residents ADD COLUMN phone text";
const DROP = "ALTER TABLE residents DROP COLUMN mobile";

if (scenario === "rename") {
  lines.push("rename at once: the migration and the new code in the same deployment");
  await recreateTable();
  await traffic("only v1 (mobile column)", ["v1"]);
  await migration("ALTER TABLE residents RENAME COLUMN mobile TO phone");
  await traffic("v1 and v4 together, during the switch", ["v1", "v4"]);
  await traffic("only v4 (phone column)", ["v4"]);
  lines.push("", "in the other order: the new code goes out before the migration");
  await recreateTable();
  await traffic("v1 and v4 together, before migrating", ["v1", "v4"]);
} else if (scenario === "expand") {
  await recreateTable();
  lines.push("deployment 1, expand: v2 writes to both columns, reads from the old one");
  await migration(ADD);
  await traffic("v1 and v2 together", ["v1", "v2"]);
  await traffic("only v2", ["v2"]);
  lines.push("", "migrate the old data, with v1 already gone");
  await copy();
  lines.push("", "deployment 2: v3 starts reading from the new column");
  await traffic("v2 and v3 together", ["v2", "v3"]);
  await traffic("only v3", ["v3"]);
  lines.push("", "deployment 3, contract: v4 knows only the new column");
  await traffic("v3 and v4 together", ["v3", "v4"]);
  await traffic("only v4", ["v4"]);
  await migration(DROP);
  await traffic("only v4, without the old column", ["v4"]);
} else if (scenario === "shortcut") {
  await recreateTable();
  lines.push("the shortcut: copy the data right after adding the column, with v1 live");
  await migration(ADD);
  await copy();
  await traffic("v1 and v2 together", ["v1", "v2"]);
  await traffic("only v2", ["v2"]);
  await traffic("v2 and v3 together", ["v2", "v3"]);
  await traffic("only v3", ["v3"]);
} else {
  throw new Error("unknown scenario: use rename, expand, or shortcut");
}

lines.push("", `total: ${totalErrors} errors and ${totalWrong} wrong reads`);
if (scenario !== "rename") {
  const r = await db.query(`SELECT count(*)::int AS total,
    count(*) FILTER (WHERE phone IS NULL)::int AS missing FROM residents`);
  lines.push(
    `check: ${r.rows[0].total} residents, ${r.rows[0].missing} without a phone`,
  );
}
if (scenario === "shortcut") {
  const r = await db.query(`SELECT count(*)::int AS n FROM residents
    WHERE phone IS DISTINCT FROM mobile`);
  lines.push(`residents whose phone differs from their mobile: ${r.rows[0].n}`);
}
await db.end();

const output = join(process.argv[2] ?? "/data", "output", scenario);
mkdirSync(output, { recursive: true });
writeFileSync(join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
