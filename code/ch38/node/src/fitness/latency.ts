// Fitness function of ADR-038: the p95 of the delinquency dashboard stays under
// 300 ms at 40 requests per second. Holistic and dynamic: runs the commit's code
// against a real PostgreSQL (PGlite, in memory), counts the queries and the rows of
// each request, and feeds that count to a simulated load.
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { Db } from "../db.ts";
import { duration, generator, percentile, simulate } from "./load.ts";

export const TARGET = {
  p95Ms: 300,
  requestsPerSecond: 40,
  seconds: 30,
  connections: 4,
};
const COMMUNITIES = 20;

// 20 communities with 51 to 199 units, three months of charges per unit
export async function testDatabase(): Promise<PGlite> {
  const pg = new PGlite();
  await pg.exec(`
    create schema directory; create schema billing;
    create table directory.units (
      id int primary key, community int not null, name text not null);
    create table billing.charges (
      unit int not null, community int not null, due_date date not null,
      amount numeric(10, 2) not null, paid boolean not null, in_plan boolean not null);
    insert into directory.units
      select c * 1000 + u, c, 'U-' || u
        from generate_series(1, ${COMMUNITIES}) c,
             generate_series(1, 40 + (c * 37) % 161) u;
    insert into billing.charges
      select id, community, date '2026-07-05' + make_interval(months => m),
             650, not (id % 6 = 0 and m > 0), id % 12 = 0
        from directory.units, generate_series(0, 2) m;`);
  return pg;
}

// A database that counts the rows of each query
function counter(pg: PGlite, rows: number[]): Db {
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const r = await pg.query<T>(sql, params);
      rows.push(r.rows.length);
      return r.rows;
    },
  };
}

type Dashboard = (db: Db, community: number) => Promise<unknown[]>;

export async function dashboardLatency(pg: PGlite, commitFolder: string) {
  const module = path.join(commitFolder, "billing", "dashboard.ts");
  const { delinquencyDashboard } = (await import(module)) as {
    delinquencyDashboard: Dashboard;
  };
  // The profile of each community: how many rows each query returned
  const profiles: number[][] = [];
  for (let c = 1; c <= COMMUNITIES; c++) {
    const rows: number[] = [];
    await delinquencyDashboard(counter(pg, rows), c);
    profiles.push(rows);
  }
  const draw = generator(38);
  const total = TARGET.requestsPerSecond * TARGET.seconds;
  const interval = 1000 / TARGET.requestsPerSecond;
  const arrivals = Array.from({ length: total }, (_, i) => i * interval);
  const targets = arrivals.map(() => Math.floor(draw() * COMMUNITIES));
  const durations = targets.map((c) => duration(profiles[c], draw));
  const latencies = simulate(arrivals, durations, TARGET.connections);
  const queries = targets.reduce((s, c) => s + profiles[c].length, 0) / total;
  return {
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    queriesPerRequest: queries,
    largestProfile: Math.max(...profiles.map((p) => p.length)),
  };
}
