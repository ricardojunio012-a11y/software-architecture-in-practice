// Financial report to owners: receives only what it needs, as parameters.
import type { Charge } from "../charges/index.ts";
import { monthLabel } from "../shared/dates.ts";
import { dollars } from "../shared/money.ts";

export interface Expense {
  category: string;
  amountCents: number;
}

export function financialReport(
  community: string,
  today: Date,
  charges: readonly Charge[],
  expenses: readonly Expense[],
  reserveOpeningBalance: number,
): string {
  const dues = charges.reduce((s, c) => s + c.dues, 0);
  const reserve = charges.reduce((s, c) => s + c.reserve, 0);
  const lines = [`# Financial report ${monthLabel(today)} - ${community}`];
  lines.push(`income;monthly dues;${dollars(dues)}`);
  lines.push(`income;reserve fund;${dollars(reserve)}`);
  for (const e of expenses)
    lines.push(`expenses;${e.category};${dollars(e.amountCents)}`);
  const totalExpenses = expenses.reduce((s, e) => s + e.amountCents, 0);
  lines.push(`expenses;total;${dollars(totalExpenses)}`);
  lines.push(`reserve;opening balance;${dollars(reserveOpeningBalance)}`);
  lines.push(`reserve;projected balance;${dollars(reserveOpeningBalance + reserve)}`);
  return lines.join("\n") + "\n";
}
