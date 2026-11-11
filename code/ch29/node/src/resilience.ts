// The "resilience" version: the same scenario with the protections added one at a
// time, and the bulkhead alone at the end.
import fs from "node:fs";
import path from "node:path";
import { NOTICES, PAYMENTS, type Protections, simulate } from "./scenario.ts";

const data = process.argv[2];
const t = { timeoutMs: 300 };
const configurations: [string, Protections][] = [
  ["no protection", {}],
  ["+ 300 ms timeout", t],
  ["+ 3 attempts with jitter", { ...t, attempts: 3 }],
  ["+ circuit breaker", { ...t, attempts: 3, breaker: true }],
  ["+ bulkhead with 4 slots", { ...t, attempts: 3, breaker: true, bulkhead: 4 }],
  ["bulkhead only", { bulkhead: 4 }],
];

const lines = [
  "gateway: normal until 1 s, down until 4 s, unstable until 6 s",
  `${"".padEnd(28)}notices in 200 ms  longest wait    payments     calls`,
];
for (const [name, protections] of configurations) {
  const r = await simulate(protections);
  lines.push(
    name.padEnd(30) +
      `${r.fastNotices} of ${NOTICES}`.padStart(15) +
      `${r.longestNoticeWait} ms`.padStart(14) +
      `${r.paymentsConfirmed} of ${PAYMENTS}`.padStart(12) +
      `${r.gatewayCalls}`.padStart(10),
  );
}

const output = path.join(data, "output", "resilience");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
