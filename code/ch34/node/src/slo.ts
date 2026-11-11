import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generator } from "./random.ts";
import { RULES, Series, episodes, firing } from "./sre.ts";

// A month of the Morada payments API, minute by minute, with a fixed seed
const DAY = 1440;
const SLO = 0.9995; // internal objective
const SLA = 0.999; // what the contract promises

interface Incident {
  id: string;
  description: string;
  start: number; // minute of the month
  end: number;
  error: number; // fraction of requests that fail during the incident
}

const when = (day: number, h: number, min = 0) => (day - 1) * DAY + h * 60 + min;

export const INCIDENTS: Incident[] = [
  {
    id: "A",
    description: "gateway degraded",
    start: when(5, 10, 12),
    end: when(5, 10, 34),
    error: 0.08,
  },
  {
    id: "B",
    description: "replica restarts",
    start: when(18, 3, 7),
    end: when(18, 3, 8),
    error: 0.2,
  },
  {
    id: "C",
    description: "cards declined",
    start: when(22, 14),
    end: when(22, 22),
    error: 0.006,
  },
  {
    id: "D",
    description: "short timeout",
    start: when(26, 0),
    end: when(31, 0),
    error: 0.0008,
  },
];
const NOISE = 0.0001;

// Requests per minute: few overnight, more by day, five times more on the 5th
function volume(minute: number, draw: () => number): number {
  const day = Math.floor(minute / DAY) + 1;
  const hour = Math.floor((minute % DAY) / 60);
  let base = hour < 6 ? 60 : hour < 8 ? 200 : hour < 20 ? 400 : 250;
  if (day <= 10) base *= 1.5;
  if (day === 5 && hour >= 8 && hour < 22) base *= 5 / 1.5;
  return Math.round(base * (0.8 + 0.4 * draw()));
}

export function generateMonth(seed: number) {
  const draw = generator(seed);
  const series = new Series();
  const byCause = new Map<string, number>([["noise", 0]]);
  for (let m = 0; m < 30 * DAY; m++) {
    const requests = volume(m, draw);
    const incident = INCIDENTS.find((i) => m >= i.start && m < i.end);
    let errors = 0;
    for (let r = 0; r < requests; r++) {
      if (incident && draw() < incident.error) {
        byCause.set(incident.id, (byCause.get(incident.id) ?? 0) + 1);
        errors++;
      } else if (draw() < NOISE) {
        byCause.set("noise", byCause.get("noise")! + 1);
        errors++;
      }
    }
    series.add(requests, errors);
  }
  return { series, byCause };
}

const two = (n: number) => String(n).padStart(2, "0");
// Month/day and time of a minute of November, as in "11/05 10:12"
export const timeOf = (minute: number) => {
  if (minute === 30 * DAY) return "11/30 24:00";
  const day = Math.floor(minute / DAY) + 1;
  const rest = minute % DAY;
  return `11/${two(day)} ${two(Math.floor(rest / 60))}:${two(rest % 60)}`;
};
const num = (n: number) => n.toLocaleString("en-US");
const pct = (n: number, places = 0) => (100 * n).toFixed(places) + "%";

function main() {
  const { series, byCause } = generateMonth(34);
  const total = series.window(series.minutes, series.minutes);
  const budget = Math.floor(total.requests * (1 - SLO));
  const slaLimit = Math.floor(total.requests * (1 - SLA));

  // The minute the month's budget ran out, and what was left at the end of each day
  let exhausted = -1;
  const remaining: string[] = ["day,remaining"];
  for (let m = 1; m <= series.minutes; m++) {
    const spent = series.window(m, m).errors;
    if (exhausted < 0 && spent > budget) exhausted = m;
    if (m % DAY === 0) remaining.push(`${m / DAY},${(1 - spent / budget).toFixed(3)}`);
  }

  const l: string[] = [
    "Payments API, November 2026: 30 simulated days, seed 34",
    "",
    `requests: ${num(total.requests)}   failed: ${num(total.errors)}`,
    `availability SLI: ${pct(1 - total.errors / total.requests, 3)}`,
    `internal SLO of ${pct(SLO, 2)}: budget of ${num(budget)} failed requests,` +
      ` ${pct(total.errors / budget)} consumed`,
    exhausted > 0
      ? `   budget exhausted at ${timeOf(exhausted)}`
      : "   budget not exhausted",
    `contract SLA, ${pct(SLA, 1)}: limit of ${num(slaLimit)} failed requests,` +
      ` ${total.errors <= slaLimit ? "met" : "missed"}`,
    "",
    "where the budget went".padEnd(59) + "errors" + "of budget".padStart(14),
  ];
  for (const i of INCIDENTS) {
    const period = `${timeOf(i.start)} to ${timeOf(i.end)}`;
    const errors = byCause.get(i.id) ?? 0;
    l.push(
      `${i.id}  ${period}  ${i.description} (${pct(i.error, 2)})`.padEnd(59) +
        `${num(errors).padStart(6)}  ${pct(errors / budget).padStart(12)}`,
    );
  }
  const noise = byCause.get("noise")!;
  l.push(
    `   the whole month, background noise (${pct(NOISE, 2)})`.padEnd(59) +
      `${num(noise).padStart(6)}  ${pct(noise / budget).padStart(12)}`,
    "",
    "error budget burn rate alerts (multiwindow)",
    "rule".padEnd(32) + "fires".padEnd(14) + "stops firing",
  );
  for (const r of RULES) {
    const eps = episodes(series, (m) => firing(series, r, SLO, m));
    if (eps.length === 0) l.push(`${r.name.padEnd(32)}never`);
    for (const e of eps)
      l.push(`${r.name.padEnd(32)}${timeOf(e.start)}   ${timeOf(e.end)}`);
  }

  // The naive alert: more than 1% errors in the last 5 minutes, at any hour
  const naive = episodes(series, (m) => {
    const w = series.window(m, 5);
    return w.requests > 0 && w.errors / w.requests > 0.01;
  });
  const overnight = naive.filter((e) => e.start % DAY < 6 * 60);
  const during = (i: Incident) =>
    naive.filter((e) => e.start >= i.start && e.start <= i.end + 5);
  const outside = naive.length - INCIDENTS.reduce((n, i) => n + during(i).length, 0);
  const short = naive.filter((e) => e.end - e.start <= 5).length;
  l.push(
    "",
    "naive alert: more than 1% errors in the last 5 minutes",
    `notifications: ${naive.length}   overnight (midnight to 6 a.m.): ` +
      `${overnight.length}   lasting up to 5 minutes: ${short}`,
    "by incident: " +
      INCIDENTS.map((i) => `${i.id} ${during(i).length}`).join(", ") +
      `; outside them: ${outside}`,
    "",
  );

  const folder = join(process.argv[2] ?? ".", "output", "slo");
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "result.txt"), l.join("\n"));
  writeFileSync(join(folder, "budget.csv"), remaining.join("\n") + "\n");
  writeFileSync(
    join(folder, "naive-alert.txt"),
    naive.map((e) => `${timeOf(e.start)}   ${timeOf(e.end)}`).join("\n") + "\n",
  );
  console.log(l.join("\n"));
}

if (process.argv[1]?.endsWith("slo.ts")) main();
