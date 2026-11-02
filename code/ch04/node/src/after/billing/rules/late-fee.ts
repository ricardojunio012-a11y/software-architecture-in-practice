import { percentOf } from "../../../shared/money.ts";
import { entry } from "../types.ts";
import type { Entry, Rule, Unit } from "../types.ts";

// A one-time late fee on the past-due balance.
export class LateFee implements Rule {
  readonly #percent: number;

  constructor(percent: number) {
    this.#percent = percent;
  }

  apply(unit: Unit): Entry[] {
    const d = unit.pastDue;
    if (!d) return [];
    const fee = percentOf(d.amountCents, this.#percent);
    return [entry("late-fee", `Late fee (${this.#percent}%)`, fee)];
  }
}
