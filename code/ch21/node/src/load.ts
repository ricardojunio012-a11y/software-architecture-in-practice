// The "n1" and "fixed" versions: starts the API, profiles one request, and runs the
// load test of the 5th with k6. The profile (queries per request and response) is
// deterministic and goes to output/<version>; the timings depend on the machine and
// go to output/times-<version>.txt.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const [data, version] = process.argv.slice(2);
const BASE = "http://localhost:3000";

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query(fs.readFileSync(path.join(data, "sql", "data.sql"), "utf8"));
await db.end();

const api = spawn("node", ["--disable-warning=ExperimentalWarning", "src/server.ts"], {
  env: { ...process.env, VERSION: version },
  stdio: "inherit",
});
for (let i = 0; ; i++) {
  try {
    if ((await fetch(`${BASE}/health`)).ok) break;
  } catch {
    if (i > 50) throw new Error("the API did not start");
    await new Promise((r) => setTimeout(r, 100));
  }
}

// The profile of one request: how many queries, and the response (which must be the
// same in both versions)
await fetch(`${BASE}/profile`);
const body = await (await fetch(`${BASE}/communities/7/delinquent`)).text();
const profile = await (await fetch(`${BASE}/profile`)).json();
const rows = JSON.parse(body);
const owing = rows.filter((r: any) => r.open_cents > 0).length;
const digest = createHash("sha256").update(body).digest("hex").slice(0, 12);

const output = path.join(data, "output", version);
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(
  path.join(output, "profile.txt"),
  [
    `version: ${version}`,
    "route: GET /communities/7/delinquent",
    `database queries per request: ${profile.queries}`,
    `units in the response: ${rows.length}, ${owing} with an open balance`,
    `response digest (sha256): ${digest}`,
    "",
  ].join("\n"),
);

// The load test
const summary = "/tmp/k6-summary.json";
const k6 = spawnSync(
  "k6",
  [
    "run",
    "--quiet",
    "--summary-trend-stats=avg,med,p(95),p(99),max",
    `--summary-export=${summary}`,
    "k6/day5.js",
  ],
  { env: { ...process.env, BASE_URL: BASE }, stdio: "inherit" },
);
api.kill();

const m = JSON.parse(fs.readFileSync(summary, "utf8")).metrics;
const d = m.http_req_duration;
const ms = (v: number) => `${v.toFixed(1)} ms`;
const times = [
  `version: ${version} (times measured on this machine)`,
  `requests: ${m.http_reqs.count}, ${m.http_reqs.rate.toFixed(1)} per second`,
  `latency: avg ${ms(d.avg)}, median ${ms(d.med)}, p95 ${ms(d["p(95)"])}, ` +
    `p99 ${ms(d["p(99)"])}, max ${ms(d.max)}`,
  `failures: ${(m.http_req_failed.value * 100).toFixed(2)}%`,
  `p95 < 300 ms threshold: ${k6.status === 0 ? "passed" : "failed"}`,
  "",
];
fs.writeFileSync(path.join(data, "output", `times-${version}.txt`), times.join("\n"));
console.log(times.join("\n"));
