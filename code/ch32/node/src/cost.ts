// The "cost" version: one whole month of Morada, the API and the financial report, in
// four ways of running. Infrastructure only: people are left to the text.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { monthLoad, PER_DAY } from "./load.ts";
import { PREMISES, simulate } from "./cluster.ts";
import { config, readManifests } from "./manifests.ts";
import { cost } from "./platform.ts";
import { HOURS_PER_MONTH, num, PRICES } from "./prices.ts";
import { monthOfReports } from "./reports.ts";

const data = process.argv[2] ?? "/data";
const cfg = config(readManifests(join(data, "k8s")));
const month = monthLoad(2026);

// Pre-scaling only on the 5th, from 7:30 to 10:30 a.m.
const preScale = (t: number) => {
  const day = Math.floor(t / (PER_DAY * 15)) + 1;
  const h = (t % (PER_DAY * 15)) / 3600;
  return day === 5 && h >= 7.5 && h < 10.5 ? 20 : cfg.min;
};
const withHpa = simulate(cfg, month, { name: "HPA", min: preScale });
const fixed = simulate(cfg, month, { name: "fixed", fixed: 24 });
const fixedNodes = Math.ceil(24 / Math.floor(PREMISES.nodeCpu / cfg.cpuPerPod));
// With Kamal, no automatic scaling: 9 replicas on 3 machines, and 24 replicas for
// the whole 5th, with the extra machines requested the day before (planned)
const whole5th = (t: number) => (Math.floor(t / (PER_DAY * 15)) === 4 ? 24 : 9);
const planned = simulate(cfg, month, { name: "planned", fixed: whole5th });

const controlPlane = HOURS_PER_MONTH * PRICES.eksPerHour; // EKS control plane
const nodes = (seconds: number) => (seconds / 3600) * PRICES.nodePerHour;

// The financial report as a function
const { eBatch, eOnDemand } = monthOfReports();
const fn = cost([...eBatch, ...eOnDemand]).dollars;
// ... or in the cluster: a Job on the 1st with 10 replicas of 1 vCPU (5 extra nodes
// for the duration of the batch, plus the node startup) and one 1-vCPU replica
// always on for the on-demand requests (half a node the whole month)
const batchTime = eBatch.reduce((s, e) => s + e.billed, 0) / 1000 / 10;
const job = nodes(5 * (batchTime + PREMISES.nodeStartup + PREMISES.pullImage));
const alwaysOn = 0.5 * HOURS_PER_MONTH * PRICES.nodePerHour;

const rows: [string, number, string][] = [
  [
    "API on EKS, HPA and pre-scaling",
    controlPlane + nodes(withHpa.nodeSeconds),
    `${num(withHpa.nodeSeconds / 3600, 0)} node-hours + control plane`,
  ],
  [
    "API on EKS, 24 fixed replicas",
    controlPlane + nodes(fixed.nodeSeconds),
    `${num(fixed.nodeSeconds / 3600, 0)} node-hours + control plane`,
  ],
  [
    `API on ${fixedNodes} Kamal VMs`,
    fixedNodes * HOURS_PER_MONTH * PRICES.nodePerHour,
    `${fixedNodes} fixed machines`,
  ],
  [
    "API on Kamal VMs, planned",
    nodes(planned.nodeSeconds),
    `${num(planned.nodeSeconds / 3600, 0)} node-hours, 3 to 8 VMs`,
  ],
  ["PDF as a function", fn, `${num(eBatch.length + eOnDemand.length, 0)} calls`],
  ["PDF in the cluster", job + alwaysOn, "Job + 1 fixed replica"],
];

const millions = (month.reduce((a, b) => a + b, 0) * 15) / 1e6;
const out = [
  "one month (30 days), infrastructure only, AWS prices in N. Virginia (us-east-1)",
  `API: ${num(millions, 1)} million requests; ` +
    `not answered in time: HPA ${num(withHpa.lost, 0)}, ` +
    `planned ${num(planned.lost, 0)}`,
  "",
  "approach".padEnd(32) + "$/month".padStart(10) + "   basis",
  ...rows.map(
    ([name, dollars, basis]) =>
      name.padEnd(32) + num(dollars, 2).padStart(10) + `   ${basis}`,
  ),
];

const folder = join(data, "output", "cost");
mkdirSync(folder, { recursive: true });
writeFileSync(join(folder, "result.txt"), out.join("\n") + "\n");
console.log(out.join("\n"));
