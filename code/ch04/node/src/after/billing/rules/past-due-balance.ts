import { monthDay } from "../../../shared/dates.ts";
import { entry } from "../types.ts";
import type { Entry, Rule, Unit } from "../types.ts";

// The amount left unpaid from the previous month.
export class PastDueBalance implements Rule {
  apply(unit: Unit): Entry[] {
    const d = unit.pastDue;
    if (!d) return [];
    const description = `Past-due balance (due ${monthDay(d.dueDate)})`;
    return [entry("arrears", description, d.amountCents)];
  }
}
