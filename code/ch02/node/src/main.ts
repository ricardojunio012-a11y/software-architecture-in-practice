// Usage: node main.ts <scenarios.json>
// Runs each scenario, prints the report and exits with an error if any of them fails.
import fs from "node:fs";
import { run, type Scenario } from "./scenarios.ts";

const number = (n: number) => Math.round(n).toLocaleString("en-US");
const decimal = (n: number, places: number) => n.toFixed(places);

// 2.25 s | 4 min | 6 h 40 min
function duration(seconds: number): string {
  if (seconds < 60) return `${decimal(seconds, 2)} s`;
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  if (h === 0) return `${minutes} min`;
  return minutes % 60 === 0 ? `${h} h` : `${h} h ${minutes % 60} min`;
}

const scenarios: Scenario[] = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const today = new Date("2026-03-02T00:00:00Z");
let failures = 0;

for (const s of scenarios) {
  const r = run(s, today);
  if (!r.passed) failures++;
  const throughput = r.charges / r.calculationSeconds;
  console.log(`${s.id}: ${s.description}`);
  console.log(
    `  charges: ${number(r.charges)}  target: within ${duration(s.limitSeconds)}`,
  );
  console.log(
    `  calculation (measured): ${duration(r.calculationSeconds)}, ` +
      `${number(throughput)} per second`,
  );
  console.log(
    `  invoices at the processor (estimated, ${s.invoicesPerSecond}/s): ` +
      duration(r.processorSeconds),
  );
  console.log(
    `  notices: ${decimal(r.noticeBytes / 1e6, 1)} MB, ` +
      `${number(r.noticeBytes / r.charges)} bytes per notice`,
  );
  console.log(`  result: ${r.passed ? "PASSED" : "FAILED"}`);
}
console.log(
  `${scenarios.length - failures} of ${scenarios.length} scenarios within target.`,
);
process.exitCode = failures > 0 ? 1 : 0;
