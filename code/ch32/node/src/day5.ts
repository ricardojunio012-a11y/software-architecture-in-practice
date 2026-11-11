// The "hpa" version: the 5th of the month in four scenarios, with the values read
// from k8s/
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { monthLoad, PER_DAY } from "./load.ts";
import { simulate, type Scenario, type Result } from "./cluster.ts";
import { config, readManifests } from "./manifests.ts";
import { num } from "./prices.ts";

const data = process.argv[2] ?? "/data";
const cfg = config(readManifests(join(data, "k8s")));
const day5 = monthLoad(2026).slice(4 * PER_DAY, 5 * PER_DAY);

const two = (n: number) => String(Math.floor(n)).padStart(2, "0");
const hour = (t: number) => `${two(t / 3600)}:${two((t % 3600) / 60)}`;
const clock = (t: number) => `${hour(t)}:${two(t % 60)}`;

// Pre-scaling: from 7:30 to 10:30 a.m., the minimum goes up to 20 replicas
export const preScale = (t: number) =>
  t >= 7.5 * 3600 && t < 10.5 * 3600 ? 20 : cfg.min;

const scenarios: Scenario[] = [
  { name: `${cfg.min} fixed replicas`, fixed: cfg.min },
  { name: "24 fixed replicas", fixed: 24 },
  { name: `HPA (${cfg.min} to ${cfg.max}, target ${cfg.target}%)` },
  { name: "HPA with pre-scaling at 07:30", min: preScale },
];

const peak = day5.indexOf(Math.max(...day5));
const out: string[] = [
  `day 5: ${num(day5.reduce((a, b) => a + b, 0) * 15, 0)} requests; ` +
    `peak of ${day5[peak]} requests/s at ${hour(peak * 15)}`,
  `replica: ${cfg.cpuPerPod}m of CPU requested; node: 2 vCPU, 3 replicas per node`,
  "",
  "scenario".padEnd(30) +
    "slow".padStart(8) +
    "no response".padStart(14) +
    "replicas".padStart(10) +
    "node-hours".padStart(12) +
    "replica-hours".padStart(14),
];
const results: [Scenario, Result][] = [];
for (const c of scenarios) {
  const r = simulate(cfg, day5, c);
  results.push([c, r]);
  const pct = (v: number) => `${num((100 * v) / r.requests, 2)}%`;
  out.push(
    c.name.padEnd(30) +
      pct(r.slow).padStart(8) +
      pct(r.lost).padStart(14) +
      `up to ${r.maxReady}`.padStart(10) +
      num(r.nodeSeconds / 3600, 1).padStart(12) +
      num(r.podSeconds / 3600, 1).padStart(14),
  );
}

// The timeline of the 8 a.m. reminder, every 15 s, in the two scenarios with HPA
function timeline(r: Result): string[] {
  const lines = [
    "time".padEnd(9) +
      "req/s".padStart(9) +
      "desired".padStart(11) +
      "ready".padStart(9) +
      "pending".padStart(11) +
      "nodes".padStart(7) +
      "use".padStart(6) +
      "slow".padStart(9) +
      "no response".padStart(14),
  ];
  for (const l of r.rows) {
    if (l.t < 8 * 3600 - 15 || l.t > 8 * 3600 + 240) continue;
    lines.push(
      clock(l.t).padEnd(9) +
        String(l.load).padStart(9) +
        String(l.desired).padStart(11) +
        String(l.ready).padStart(9) +
        String(l.pending).padStart(11) +
        String(l.nodes).padStart(7) +
        `${Math.round(l.usage)}%`.padStart(6) +
        num(l.slow, 0).padStart(9) +
        num(l.lost, 0).padStart(14),
    );
  }
  return lines;
}

const folder = join(data, "output", "hpa");
mkdirSync(folder, { recursive: true });
writeFileSync(join(folder, "result.txt"), out.join("\n") + "\n");
writeFileSync(
  join(folder, "reminder-hpa.txt"),
  timeline(results[2][1]).join("\n") + "\n",
);
writeFileSync(
  join(folder, "reminder-prescale.txt"),
  timeline(results[3][1]).join("\n") + "\n",
);
console.log(out.join("\n"));
console.log("\nHPA, the 8 a.m. reminder every 15 seconds:");
console.log(timeline(results[2][1]).join("\n"));
