// One month of financial reports: the batch on the 1st and the on-demand requests.
// All the numbers are premises of the lab, with a fixed seed.
import { generator } from "./load.ts";
import type { FinancialReport } from "./function/report.ts";
import { execute, type Call, type Execution } from "./platform.ts";

export const MIN = 60_000; // ms
const DAY = 24 * 60 * MIN;
export const BATCH_CONCURRENCY = 50; // protects the database the function queries

// Generation time, without the cold start: 150 ms plus 3 ms per unit
export const duration = (units: number) => 150 + 3 * units;

export function monthOfReports(seed = 32) {
  const draw = generator(seed);
  // 3,000 communities with 20 to 400 units, most of them small
  const units = Array.from({ length: 3000 }, () => 20 + Math.floor(draw() ** 2 * 380));
  // On the 1st, at 2 a.m., one message per community goes into the queue
  const batch: Call[] = units.map((u) => ({
    arrival: 2 * 60 * MIN,
    duration: duration(u),
  }));
  // 1,500 PDFs regenerated at the board president's request, 8 a.m. to 8 p.m.,
  // throughout the month
  const onDemand: Call[] = Array.from({ length: 1500 }, () => ({
    arrival:
      Math.floor(draw() * 30) * DAY + 8 * 60 * MIN + Math.floor(draw() * 12 * 60 * MIN),
    duration: duration(units[Math.floor(draw() * units.length)]),
  }));
  const eBatch: Execution[] = execute(batch, BATCH_CONCURRENCY);
  const eOnDemand: Execution[] = execute(onDemand);
  return { units, eBatch, eOnDemand };
}

// A sample report, with amounts proportional to the size of the community
export function sampleReport(i: number, u: number): FinancialReport {
  const dues = u * 61_500; // $615 per unit
  const share = (f: number) => -Math.round(dues * f);
  return {
    community: `community-${String(i + 1).padStart(4, "0")}`,
    period: "2026-10",
    entries: [
      { date: "10/05", description: "Monthly dues received", cents: dues },
      { date: "10/10", description: "Front desk payroll", cents: share(0.42) },
      { date: "10/15", description: "Common area electricity", cents: share(0.08) },
      { date: "10/20", description: "Elevator maintenance", cents: share(0.06) },
      { date: "10/31", description: "Reserve fund (10%)", cents: share(0.1) },
    ],
  };
}
