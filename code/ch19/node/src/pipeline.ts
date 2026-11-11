// The "elt" version: extracts from PostgreSQL, loads into DuckDB, transforms into the
// dimensional model, checks quality, and writes the delinquency report.
import fs from "node:fs";
import path from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import pg from "pg";
import { extract } from "./extract.ts";
import { runChecks } from "./quality.ts";

const data = process.argv[2];
const output = path.join(data, "output", "elt");
const rawZone = "/tmp/raw-zone";
fs.mkdirSync(output, { recursive: true });
const read = (file: string) => fs.readFileSync(path.join(data, file), "utf8");

// The source: Morada's transactional database
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query(read("sql/source.sql"));
const extracted = await extract(db, process.env.PSEUDONYM_KEY!, rawZone);
await db.end();

// The destination: an analytics database, columnar, in a single file
const file = "/tmp/analytics.duckdb";
fs.rmSync(file, { force: true });
const con = await (await DuckDBInstance.create(file)).connect();
const model = read("sql/model.sql")
  .replaceAll("{raw}", rawZone)
  .replaceAll("{input}", path.join(data, "input"));
// One statement at a time: each one ends with ";" at the end of the line
for (const statement of model.split(/;\s*\n/).filter((s) => s.trim())) {
  await con.run(statement);
}

const quality = await runChecks(con);

const row = (cells: string[]) =>
  [
    cells[0].padEnd(13),
    cells[1].padEnd(8),
    cells[2].padStart(7),
    cells[3].padStart(5),
    cells[4].padStart(11),
  ].join("  ");
const report = await con.runAndReadAll(read("sql/report.sql"));
const lines = report
  .getRowObjects()
  .map((r) =>
    row([
      String(r.region),
      String(r.size),
      String(r.charges),
      String(r.open_charges),
      `${Number(r.delinquency).toFixed(1)}%`,
    ]),
  );
const header = row(["region", "size", "charges", "open", "delinquency"]);

const sample = await con.runAndReadAll(
  "SELECT resident_id, tax_id_pseudonym FROM dim_resident ORDER BY resident_id LIMIT 3",
);

fs.writeFileSync(
  path.join(output, "report.txt"),
  [
    "delinquency by region and size (charges from April to September 2026)",
    header,
    ...lines,
    "",
  ].join("\n"),
);
fs.writeFileSync(path.join(output, "quality.txt"), quality.join("\n") + "\n");
fs.writeFileSync(
  path.join(output, "extraction.txt"),
  [
    ...Object.entries(extracted).map(([t, n]) => `${t}: ${n} rows extracted`),
    "sample of dim_resident:",
    ...sample.getRowObjects().map((r) => `  ${r.resident_id} | ${r.tax_id_pseudonym}`),
    "",
  ].join("\n"),
);
console.log(`elt: ${lines.length} groups in the report`);
