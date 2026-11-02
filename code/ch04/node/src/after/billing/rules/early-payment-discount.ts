import { monthDay } from "../../../shared/dates.ts";
import { percentOf } from "../../../shared/money.ts";
import { amountOf, entry } from "../types.ts";
import type { Entry, Rule, Unit } from "../types.ts";

// Discount on the dues owed for whoever pays by the agreed day.
// A unit with a past-due balance gets no discount (the chapter 1 rule).
export class EarlyPaymentDiscount implements Rule {
  readonly #percent: number;
  readonly #until: string;

  constructor(percent: number, until: string) {
    this.#percent = percent;
    this.#until = until;
  }

  apply(_unit: Unit, posted: readonly Entry[]): Entry[] {
    const duesOwed = amountOf(posted, "dues") + amountOf(posted, "exemption");
    if (duesOwed <= 0 || amountOf(posted, "arrears") > 0) return [];
    const description = `Discount by ${monthDay(this.#until)} (${this.#percent}%)`;
    const discount = percentOf(duesOwed, this.#percent);
    return [entry("discount", description, -discount, true)];
  }
}
