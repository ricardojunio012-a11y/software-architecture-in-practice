// Before: the shortcut. Bookings reads the Billing table directly and reimplements
// the delinquency rule on its own, unaware that an installment agreement keeps the
// unit in good standing.
import type { ChargesTable } from "../../billing/internal/table.ts";
import type { FinancialStanding } from "../api.ts";

export class StandingFromTable implements FinancialStanding {
  readonly #table: ChargesTable;

  constructor(table: ChargesTable) {
    this.#table = table;
  }

  unitInGoodStanding(unit: string, today: string): boolean {
    return !this.#table.rows.some(
      (r) => r.unit === unit && r.status !== "paid" && r.dueDate < today,
    );
  }
}
