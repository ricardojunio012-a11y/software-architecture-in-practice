// Reports: only read charges and registrations. A new rule shows up here on its own.
import { monthDay } from "../shared/dates.ts";
import { dollars } from "../shared/money.ts";
import type { Charge } from "./billing/charge.ts";
import type { Deadlines, Registration } from "./issuing/gateway.ts";

const line = (text: string, amount: number) =>
  "  " + text.padEnd(40) + dollars(amount).padStart(10);

export function chargeReport(
  title: string,
  charges: readonly Charge[],
  deadlines: Deadlines,
): string {
  const lines = [`# Charges ${title}`];
  for (const c of charges) {
    lines.push("", `${c.unit} ${c.resident}`);
    for (const e of c.entries) lines.push(line(e.description, e.amount));
    lines.push(line("Total", c.total));
    if (c.discount > 0) {
      const text = `Total with discount by ${monthDay(deadlines.discountUntil)}`;
      lines.push(line(text, c.total - c.discount));
    }
  }
  return lines.join("\n") + "\n";
}

export function registrationReport(
  title: string,
  gateway: string,
  charges: readonly Charge[],
  registrations: readonly Registration[],
): string {
  const lines = [`# Registrations ${title} - ${gateway}`];
  lines.push("unit;identifier;amount;discount");
  registrations.forEach((r, i) => {
    const c = charges[i];
    lines.push(`${r.unit};${r.identifier};${dollars(c.total)};${dollars(c.discount)}`);
  });
  return lines.join("\n") + "\n";
}
