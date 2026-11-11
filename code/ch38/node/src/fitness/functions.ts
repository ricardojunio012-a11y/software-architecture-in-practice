// The pipeline's fitness functions, each one linked to the ADR it protects
import type { PGlite } from "@electric-sql/pglite";
import { ownData } from "./own-data.ts";
import { dashboardLatency, TARGET } from "./latency.ts";

export type Result = { ok: boolean; details: string[] };
export type FitnessFunction = {
  name: string;
  adr: number;
  rule: string;
  check: (folder: string, pg: PGlite) => Promise<Result>;
};

const ms = (n: number) => `${Math.round(n).toLocaleString("en-US")} ms`;

export const FUNCTIONS: FitnessFunction[] = [
  {
    name: "own-data",
    adr: 10,
    rule: "no module reads or writes another module's table",
    async check(folder) {
      const violations = ownData(folder);
      return { ok: violations.length === 0, details: violations };
    },
  },
  {
    name: "dashboard-latency",
    adr: 38,
    rule:
      `dashboard p95 under ${TARGET.p95Ms} ms` +
      ` at ${TARGET.requestsPerSecond} requests/s`,
    async check(folder, pg) {
      const r = await dashboardLatency(pg, folder);
      const queries = r.queriesPerRequest.toFixed(1);
      return {
        ok: r.p95 < TARGET.p95Ms,
        details: [
          `p50 ${ms(r.p50)}, p95 ${ms(r.p95)}; ${queries} queries per request` +
            ` (up to ${r.largestProfile})`,
        ],
      };
    },
  },
];
