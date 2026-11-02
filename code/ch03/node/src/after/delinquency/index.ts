// Delinquency report: reads the charges, never changes them.
import type { Charge } from "../charges/index.ts";
import { monthLabel } from "../shared/dates.ts";
import { dollars } from "../shared/money.ts";

export function delinquencyReport(
  community: string,
  today: Date,
  charges: readonly Charge[],
): string {
  const inArrears = charges
    .filter((c) => c.arrears > 0)
    .sort((a, b) => b.arrears - a.arrears);
  const lines = [`# Delinquency ${monthLabel(today)} - ${community}`];
  lines.push("unit;resident;days;arrears;late_fee;interest;amount_due");
  let sum = [0, 0, 0, 0];
  for (const c of inArrears) {
    const values = [
      c.arrears,
      c.lateFee,
      c.interest,
      c.arrears + c.lateFee + c.interest,
    ];
    sum = sum.map((s, i) => s + values[i]);
    lines.push([c.unit, c.resident, c.daysLate, ...values.map(dollars)].join(";"));
  }
  lines.push(["total", "", "", ...sum.map(dollars)].join(";"));
  return lines.join("\n") + "\n";
}
