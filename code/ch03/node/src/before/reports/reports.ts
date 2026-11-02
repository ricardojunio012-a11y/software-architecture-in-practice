// Billing reports: delinquency and the financial report to owners.
import { config } from "../config/config.ts";
import { charges, lateInterest } from "../services/services.ts";
import { daysLate, dollars, period } from "../util/util.ts";

export function generateReport(type: string): string {
  const name = config.data.community.name;
  if (type === "delinquency") {
    // Sorts the other module's list in place (content coupling)
    charges.sort((a, b) => b.arrears - a.arrears);
    const lines = [`# Delinquency ${period()} - ${name}`];
    lines.push("unit;resident;days;arrears;late_fee;interest;amount_due");
    let sum = [0, 0, 0, 0];
    for (const c of charges.filter((x) => x.arrears > 0)) {
      const due = c.unit.pastDue.dueDate;
      // recalculates what already exists
      const interest = lateInterest(c.arrears, due);
      const amountDue = c.arrears + c.lateFee + interest;
      const values = [c.arrears, c.lateFee, interest, amountDue];
      sum = sum.map((s, i) => s + values[i]);
      const days = daysLate(due);
      lines.push(
        [c.unit.id, c.unit.resident.name, days, ...values.map(dollars)].join(";"),
      );
    }
    lines.push(["total", "", "", ...sum.map(dollars)].join(";"));
    return lines.join("\n") + "\n";
  }
  // any other type becomes the financial report
  const dues = charges.reduce((s, c) => s + c.dues, 0);
  const reserve = charges.reduce((s, c) => s + c.reserve, 0);
  const lines = [`# Financial report ${period()} - ${name}`];
  lines.push(`income;monthly dues;${dollars(dues)}`);
  lines.push(`income;reserve fund;${dollars(reserve)}`);
  let totalExpenses = 0;
  for (const e of config.data.expenses) {
    totalExpenses += e.amountCents;
    lines.push(`expenses;${e.category};${dollars(e.amountCents)}`);
  }
  lines.push(`expenses;total;${dollars(totalExpenses)}`);
  const balance = config.data.reserveFundOpeningBalanceCents;
  lines.push(`reserve;opening balance;${dollars(balance)}`);
  lines.push(`reserve;projected balance;${dollars(balance + reserve)}`);
  return lines.join("\n") + "\n";
}
