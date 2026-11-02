import { percentOf } from "../../../shared/money.ts";
import { amountOf, entry } from "../types.ts";
import type { Entry, Rule, Unit } from "../types.ts";

// A percentage of the monthly dues, for the reserve fund.
export class ReserveFund implements Rule {
  readonly #percent: number;

  constructor(percent: number) {
    this.#percent = percent;
  }

  apply(_unit: Unit, posted: readonly Entry[]): Entry[] {
    const reserve = percentOf(amountOf(posted, "dues"), this.#percent);
    return [entry("reserve", `Reserve fund (${this.#percent}%)`, reserve)];
  }
}
