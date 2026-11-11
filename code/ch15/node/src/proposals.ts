// The "compatibility" version: compares each proposal in input/proposals with the
// published contract and says whether it can be published without breaking clients.
import fs from "node:fs";
import path from "node:path";
import { compareContracts } from "./contract/compatibility.ts";
import { readContract } from "./contract/openapi.ts";

const data = process.argv[2];
const published = readContract(path.join(data, "openapi", "published", "v1.yaml"));
const folder = path.join(data, "input", "proposals");

const report: string[] = [];
let incompatible = 0;
const proposals = fs.readdirSync(folder).sort();
for (const file of proposals) {
  const changes = compareContracts(published, readContract(path.join(folder, file)));
  const breaks = changes.some((c) => !c.compatible);
  if (breaks) incompatible++;
  report.push(`${file}: ${breaks ? "INCOMPATIBLE" : "compatible"}`);
  for (const c of changes) report.push(`  ${c.compatible ? "+" : "-"} ${c.text}`);
}
report.push("", `incompatible proposals: ${incompatible} of ${proposals.length}`);

const output = path.join(data, "output", "compatibility");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "report.txt"), report.join("\n") + "\n");
console.log(`compatibility: ${incompatible} of ${proposals.length} incompatible`);
