// After: Bookings asks Billing through the public API. The delinquency rule stays
// in one place, the module that owns it.
import type { Billing } from "../../billing/api.ts";
import type { FinancialStanding } from "../api.ts";

export class StandingFromBilling implements FinancialStanding {
  readonly #billing: Billing;

  constructor(billing: Billing) {
    this.#billing = billing;
  }

  unitInGoodStanding(unit: string, today: string): boolean {
    return this.#billing.unitInGoodStanding(unit, today);
  }
}
