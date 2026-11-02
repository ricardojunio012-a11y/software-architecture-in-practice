import { daysBetween } from "../../../shared/dates.ts";
import { entry } from "../types.ts";
import type { Entry, Rule, Unit } from "../types.ts";

// Monthly interest, prorated by the days late (30-day month).
export class LateInterest implements Rule {
  readonly #monthlyPercent: number;
  readonly #today: Date;

  constructor(monthlyPercent: number, today: Date) {
    this.#monthlyPercent = monthlyPercent;
    this.#today = today;
  }

  apply(unit: Unit): Entry[] {
    const d = unit.pastDue;
    if (!d) return [];
    const days = daysBetween(d.dueDate, this.#today);
    const interest = Math.floor(
      (d.amountCents * this.#monthlyPercent * days + 1500) / 3000,
    );
    return [entry("interest", `Interest (${days} days)`, interest)];
  }
}
