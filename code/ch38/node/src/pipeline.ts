// The "fitness" version: three commits go through the pipeline's two fitness functions.
// First, the pipeline checks that each function protects an ADR in force.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { adrName, readLog, validate } from "./adr.ts";
import { FUNCTIONS } from "./fitness/functions.ts";
import { testDatabase } from "./fitness/latency.ts";

const data = process.argv[2];
const root = path.dirname(fileURLToPath(import.meta.url));
const COMMITS: [string, string][] = [
  ["c1", "delinquency dashboard with one aggregate query"],
  ["c2", "bookings checks the balance directly in the charges table"],
  ["c3", "dashboard sums the balance unit by unit"],
];

const links = FUNCTIONS.map((f) => ({ fn: f.name, adr: f.adr }));
const problems = validate(readLog(path.join(root, "..", "decisions")), links);
const lines = [
  `log: ${problems.length === 0 ? "valid" : problems.length + " problems"}`,
];
for (const f of FUNCTIONS)
  lines.push(`function ${f.name} (${adrName(f.adr)}): ${f.rule}`);

const pg = await testDatabase();
for (const [commit, description] of COMMITS) {
  lines.push("", `commit ${commit}: ${description}`);
  let approved = true;
  for (const f of FUNCTIONS) {
    const r = await f.check(path.join(root, "commits", commit), pg);
    approved &&= r.ok;
    lines.push(`  ${f.name.padEnd(17)} ${r.ok ? "ok" : "FAILED"}`);
    for (const d of r.details) lines.push(`      ${d}`);
  }
  lines.push(approved ? "  => approved" : "  => blocked; nothing was deployed");
}
await pg.close();

const output = path.join(data, "output", "fitness");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
