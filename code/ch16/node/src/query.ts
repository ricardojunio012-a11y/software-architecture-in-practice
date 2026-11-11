// The "query" version: the delinquency query over 1 million charges, with no index,
// with an index on the wrong column, and with the right index, created by
// migration 003. The plans go to output/query; the times, which vary, go only to the
// terminal.
import fs from "node:fs";
import path from "node:path";
import { connect, resetSchema } from "./db.ts";
import { applyMigrations } from "./migrations.ts";

type PlanNode = Record<string, any>;

const data = process.argv[2];
const read = (file: string) => fs.readFileSync(path.join(data, file), "utf8");
const migrationsFolder = path.join(data, "migrations");
const db = await connect(process.env.DATABASE_URL!);
await resetSchema(db);
const applied = await applyMigrations(db, migrationsFolder, 2);
await db.query(read("input/charges.sql"));
await db.query("ANALYZE charges");
// Without parallelism, the plan is the same on any machine and easier to read
await db.query("SET max_parallel_workers_per_gather = 0");
const query = read("input/delinquency.sql");

// The nodes that read data (table and index scans), from the JSON plan
function scans(node: PlanNode): string[] {
  const children = (node.Plans ?? []).flatMap(scans);
  if (!node["Relation Name"] && !node["Index Name"]) return children;
  const table = node["Relation Name"] ? ` on ${node["Relation Name"]}` : "";
  const index = node["Index Name"] ? ` using index ${node["Index Name"]}` : "";
  const discarded = node["Rows Removed by Filter"] ?? 0;
  const rows = `${node["Actual Rows"]} rows kept, ${discarded} discarded`;
  return [`${node["Node Type"]}${table}${index}: ${rows}`, ...children];
}

const plans: string[] = [];
async function plan(title: string) {
  const { rows } = await db.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`);
  const [explained] = rows[0]["QUERY PLAN"];
  plans.push(`${plans.length / 3 + 1}. ${title}`);
  plans.push(...scans(explained.Plan).map((line) => `   ${line}`), "");
  console.log(`${title}: ${explained["Execution Time"].toFixed(1)} ms`);
}

await plan("no index");
await db.query("CREATE INDEX charges_due_date ON charges (due_date)");
await db.query("ANALYZE charges");
await plan("index on due date only");
await db.query("DROP INDEX charges_due_date");
applied.push(...(await applyMigrations(db, migrationsFolder)));
await db.query("ANALYZE charges");
await plan("index from migration 003");

const { rows } = await db.query(query);
const result = rows.map(
  (r) => `unit ${r.unit}: open charges ${r.charges}, total ${r.total_cents} cents`,
);
await db.end();

const output = path.join(data, "output", "query");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "plans.txt"), plans.join("\n"));
fs.writeFileSync(path.join(output, "result.txt"), result.join("\n") + "\n");
fs.writeFileSync(path.join(output, "migrations.txt"), applied.join("\n") + "\n");
