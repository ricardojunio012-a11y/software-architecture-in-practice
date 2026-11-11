// The "unit" version: the table of inputs, one month's cost of Morada as it is
// today (pool, 3,000 communities), the cost per community and per invoice,
// and the showback per module.
import { INPUTS, v } from "./inputs.ts";
import { dollars, number, pct, save } from "./format.ts";
import { monthlyCost, total } from "./model.ts";

// Each module's share of the requests (a premise of this lab)
export const REQUESTS_PER_MODULE = {
  billing: 0.3,
  "front desk": 0.35,
  communications: 0.2,
  "bookings and others": 0.15,
};

const n = v("communities");
const lines = monthlyCost("pool", n);
const infra = total(lines, "infra");
const people = total(lines, "people");
const cogs = infra + people;
const invoices = n * v("invoices");
const out: string[] = ["INPUTS"];

for (const [name, input] of Object.entries(INPUTS)) {
  const value = number(input.value, Number.isInteger(input.value) ? 0 : 4);
  out.push(`  ${name.padEnd(16)}${value.padStart(9)}  ${input.unit} (${input.source})`);
}

out.push("", `COST OF ONE MONTH: pool, ${number(n)} communities`);
for (const l of lines) {
  const column = `${l.kind}, ${l.behavior}`;
  const value = dollars(l.value).padStart(11);
  out.push(`  ${l.name.padEnd(26)}${column.padEnd(18)}${value}`);
}
out.push(
  `  ${"infrastructure".padEnd(44)}${dollars(infra).padStart(11)}`,
  `  ${"people".padEnd(44)}${dollars(people).padStart(11)}`,
  `  ${"total (COGS)".padEnd(44)}${dollars(cogs).padStart(11)}`,
  "",
  "PER UNIT",
  `  per community: ${dollars(cogs / n, 2)}` +
    ` (infra ${dollars(infra / n, 2)}, people ${dollars(people / n, 2)})`,
  `  per invoice, dividing everything: ${dollars(cogs / invoices, 3)}`,
  `  COGS over the subscription: ${pct(cogs / n / v("subscription"))}`,
);

// Showback: the assistant goes straight to whoever uses it; the rest is split
// by each module's share of the requests
const direct = (tag: string) =>
  lines.filter((l) => l.tag === tag).reduce((s, l) => s + l.value, 0);
const shared = direct("shared") + direct("support");
out.push("", "SHOWBACK BY MODULE (split by requests)");
for (const [module, share] of Object.entries(REQUESTS_PER_MODULE)) {
  const value = dollars(shared * share).padStart(12);
  out.push(`  ${module.padEnd(20)}${pct(share).padStart(6)}${value}`);
}
const assistant = dollars(direct("assistant")).padStart(12);
out.push(`  ${"assistant".padEnd(20)}${"direct".padStart(6)}${assistant}`);
const billing = shared * REQUESTS_PER_MODULE.billing;
out.push(`  per invoice, Billing only: ${dollars(billing / invoices, 3)}`);

save("unit", out);
