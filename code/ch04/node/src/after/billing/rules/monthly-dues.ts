import { shareOf } from "../../../shared/money.ts";
import { entry } from "../types.ts";
import type { Entry, Rule, Unit } from "../types.ts";

// The unit's part of the month's expenses, by its ownership share.
export class MonthlyDues implements Rule {
  readonly #expenses: number;

  constructor(monthlyExpenses: number) {
    this.#expenses = monthlyExpenses;
  }

  apply(unit: Unit): Entry[] {
    const dues = shareOf(this.#expenses, unit.shareMillionths);
    return [entry("dues", "Monthly dues", dues)];
  }
}
