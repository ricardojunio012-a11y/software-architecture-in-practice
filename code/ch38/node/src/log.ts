// The "log" and "defects" versions: validates a folder of ADRs and generates the index.
// Usage: log.ts <data folder> <version> <log folder>
import fs from "node:fs";
import path from "node:path";
import { adrName, index, readLog, validate } from "./adr.ts";
import { FUNCTIONS } from "./fitness/functions.ts";

const [data, version, folder] = process.argv.slice(2);
const adrs = readLog(folder);
const links = FUNCTIONS.map((f) => ({ fn: f.name, adr: f.adr }));
const problems = validate(adrs, links);

const lines = [`log ${folder}/: ${adrs.length} files`];
for (const a of adrs) {
  const title = a.title.length > 52 ? a.title.slice(0, 51) + "…" : a.title;
  lines.push(`  ${adrName(a.number)}  ${a.status.padEnd(21)}  ${title}`);
}
lines.push("fitness functions:");
for (const f of FUNCTIONS)
  lines.push(`  ${f.name.padEnd(17)} protects ${adrName(f.adr)}`);
if (problems.length === 0) lines.push("result: valid log");
else {
  lines.push(`result: ${problems.length} problems`);
  for (const p of problems) lines.push(`  ${p}`);
}

const output = path.join(data, "output", version);
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
if (problems.length === 0) fs.writeFileSync(path.join(output, "index.md"), index(adrs));
console.log(lines.join("\n"));
// In the pipeline, a log with problems fails the change
process.exitCode = problems.length === 0 ? 0 : 1;
