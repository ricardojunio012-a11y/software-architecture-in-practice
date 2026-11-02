// Public API of Bookings. The module declares what it needs to know from Billing
// (FinancialStanding) without depending on how Billing stores its data.
import { Schedule } from "./internal/schedule.ts";

export interface FinancialStanding {
  unitInGoodStanding(unit: string, today: string): boolean;
}

export class RejectionError extends Error {}

export class Bookings {
  readonly #schedule: Schedule;
  readonly #billing: FinancialStanding;

  constructor(spaces: string[], billing: FinancialStanding) {
    this.#schedule = new Schedule(spaces);
    this.#billing = billing;
  }

  book(booking: string, unit: string, space: string, date: string, today: string) {
    if (!this.#billing.unitInGoodStanding(unit, today)) {
      throw new RejectionError(`unit ${unit} in arrears`);
    }
    const taken = this.#schedule.occupant(space, date);
    if (taken) throw new RejectionError(`${space} already booked on ${date}`);
    this.#schedule.record(booking, space, date);
    return `${unit} ${space} ${date}`;
  }
}
