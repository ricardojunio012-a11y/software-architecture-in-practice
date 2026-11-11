// The "commitment" version: how much to commit in a savings plan for the
// application nodes, given the usage of each hour of a month, and the database
// reservation.
import { v } from "./inputs.ts";
import { dollars, number, pct, save } from "./format.ts";

// Usage of a 30-day month, hour by hour (a premise of this lab): 2 nodes always,
// 3 during business hours on weekdays, 6 from 6 a.m. to 10 p.m. on the 1st and the 5th
const WEEKEND = [6, 7, 13, 14, 20, 21, 27, 28];
export function profile(): number[] {
  const hours: number[] = [];
  for (let day = 1; day <= 30; day++) {
    for (let h = 0; h < 24; h++) {
      let nodes = 2;
      if (!WEEKEND.includes(day) && h >= 8 && h < 20) nodes = 3;
      if ((day === 1 || day === 5) && h >= 6 && h < 22) nodes = 6;
      hours.push(nodes);
    }
  }
  return hours;
}

// Cost in dollars: the commitment is paid every hour, used or not; whatever
// goes beyond it is charged on demand
export function costWithCommitment(hours: number[], nodes: number, price: number) {
  const fixed = nodes * price * hours.length;
  const excess = hours.reduce((s, n) => s + Math.max(0, n - nodes), 0);
  return fixed + excess * v("node");
}

const hours = profile();
const nodeHours = hours.reduce((s, n) => s + n, 0);
const onDemand = nodeHours * v("node");
const out = [
  "USAGE COMMITMENT: application nodes, one 30-day month",
  `  ${number(nodeHours)} node-hours; minimum ${Math.min(...hours)}, ` +
    `maximum ${Math.max(...hours)}`,
  `  ${"commitment".padEnd(14)}${"1 year".padStart(10)}${"savings".padStart(10)}` +
    `${"3 years".padStart(10)}${"savings".padStart(10)}`,
];
for (let nodes = 0; nodes <= 6; nodes++) {
  const [c1, c3] = [v("plan1"), v("plan3")].map((p) =>
    costWithCommitment(hours, nodes, p),
  );
  const label = nodes === 1 ? "1 node" : `${nodes} nodes`;
  out.push(
    `  ${label.padEnd(14)}${dollars(c1).padStart(10)}` +
      `${pct(1 - c1 / onDemand).padStart(10)}` +
      `${dollars(c3).padStart(10)}${pct(1 - c3 / onDemand).padStart(10)}`,
  );
}

// The database stays on all month: the reservation covers 100% of the hours
const database = (price: number) => price * hours.length;
out.push(
  "",
  "DATABASE db.m7g.large Multi-AZ, running all month",
  `  on demand             ${dollars(database(v("database"))).padStart(9)}`,
  `  reserved for 1 year   ${dollars(database(v("reserved1"))).padStart(9)}` +
    `  savings of ${pct(1 - v("reserved1") / v("database"))}`,
);

save("commitment", out);
