// The "cfo" version: the table that goes to the finance leadership, with revenue,
// cost of goods sold (COGS), gross margin, and cost per unit, today and with
// 10 times more communities, in the three architectures.
import { v } from "./inputs.ts";
import { dollars, number, pct, save } from "./format.ts";
import { ARCHITECTURES, type Line, monthlyCost, total } from "./model.ts";

const today = v("communities");
const scenarios = ARCHITECTURES.flatMap(([arch]) =>
  [today, 10 * today].map((n) => ({ arch, n, lines: monthlyCost(arch, n) })),
);
const support = (ls: Line[]) =>
  ls.filter((l) => l.tag === "support").reduce((s, l) => s + l.value, 0);

const width = 11;
const cell = (s: string) => s.padStart(width);
const row = (label: string, f: (c: (typeof scenarios)[number]) => string) =>
  label.padEnd(22) + scenarios.map((c) => cell(f(c))).join("");

const revenue = (n: number) => n * v("subscription");
const cogs = (ls: Line[]) => total(ls);
const margin = (c: (typeof scenarios)[number]) => revenue(c.n) - cogs(c.lines);

const out = [
  "TABLE FOR THE CFO: one month, in dollars",
  row("", (c) => c.arch),
  row("communities", (c) => number(c.n)),
  row("revenue", (c) => number(revenue(c.n))),
  row("COGS: infrastructure", (c) => number(total(c.lines, "infra"))),
  row("COGS: operations", (c) => number(total(c.lines, "people") - support(c.lines))),
  row("COGS: support", (c) => number(support(c.lines))),
  row("COGS total", (c) => number(cogs(c.lines))),
  row("gross margin", (c) => number(margin(c))),
  row("gross margin (%)", (c) => pct(margin(c) / revenue(c.n))),
  row("infra / revenue", (c) => pct(total(c.lines, "infra") / revenue(c.n))),
  row("COGS per community", (c) => number(cogs(c.lines) / c.n, 2)),
  row("COGS per invoice", (c) => number(cogs(c.lines) / (c.n * v("invoices")), 3)),
  "",
  "Outside COGS (operating expenses): pipeline " +
    dollars(v("pipeline")) +
    " and SOC 2 " +
    dollars(v("soc2")) +
    " per month.",
];

// How much more the silo customer needs to pay so the silo does not lower the margin
for (const n of [today, 10 * today]) {
  const extra = cogs(monthlyCost("silos", n)) - cogs(monthlyCost("pool", n));
  const isolated = Math.round(n * v("isolated"));
  out.push(
    `Silos with ${number(n)} communities: ${dollars(extra)} more than the pool, ` +
      `${dollars(extra / isolated, 2)} per isolated one.`,
  );
}

save("cfo", out);
