// Usage: node batch.ts <batch.json>
// Simulates the batch invoice queue and compares time to confirmation with the target.
import fs from "node:fs";
import { availableBy, percentile, simulate, type Assumptions } from "./batch-queue.ts";

const number = (n: number) => n.toLocaleString("en-US");
const percent = (n: number) => `${n.toFixed(2)}%`;

// 10 min | 1 h 36 min | never
function duration(seconds: number | null): string {
  if (seconds === null) return "never";
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  if (h === 0) return `${minutes} min`;
  return minutes % 60 === 0 ? `${h} h` : `${h} h ${minutes % 60} min`;
}

const p: Assumptions = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
console.log(`${p.id}: ${p.description} (seed ${p.seed})`);
console.log(
  `  assumptions: ${number(p.invoices)} invoices in files of ` +
    `${number(p.invoicesPerFile)}, ${number(p.invoicesPerSecond)} per second,`,
);
console.log(
  `  return file ${duration(p.returnSeconds)} after each file, ` +
    `${p.transientFailurePercent}% transient rejections, ` +
    `1 in ${p.permanentRejectionEvery} permanent`,
);
console.log(
  `  estimate by division: ` +
    `${duration(p.invoices / p.invoicesPerSecond)}  ` +
    `target: all within ${duration(p.limitSeconds)}`,
);
let failures = 0;
for (const adjusted of [false, true]) {
  const r = simulate(p, adjusted);
  const within = availableBy(r, p.limitSeconds);
  const passed = within === p.invoices;
  if (!passed) failures++;
  const pct = (m: number) => duration(percentile(r, p.invoices, m));
  const last = Math.max(...r.availableAt.keys());
  console.log(adjusted ? "adjusted:" : "naive:");
  console.log(`  files: ${r.files}  creation attempts: ${number(r.attempts)}`);
  console.log(
    `  available at p50: ${pct(500)}  p95: ${pct(950)}  ` +
      `p99: ${pct(990)}  p99.9: ${pct(999)}`,
  );
  console.log(
    `  last available: ${duration(last)}  never created: ` +
      `${number(r.notCreated)}  by card: ${number(r.viaCard)}`,
  );
  console.log(
    `  within ${duration(p.limitSeconds)}: ${number(within)} ` +
      `(${percent((100 * within) / p.invoices)})`,
  );
  console.log(`  result: ${passed ? "PASSED" : "FAILED"}`);
}
process.exitCode = failures > 0 ? 1 : 0;
