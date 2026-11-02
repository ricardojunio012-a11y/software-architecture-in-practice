// Public API of Billing: the only door the other modules may use.
import { ChargesTable } from "./internal/table.ts";

export function dollars(cents: number): string {
  const whole = String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${whole}.${String(cents % 100).padStart(2, "0")}`;
}

export class Billing {
  readonly #table: ChargesTable;

  constructor(table: ChargesTable) {
    this.#table = table;
  }

  issue(charge: string, unit: string, amountCents: number, dueDate: string) {
    this.#table.rows.push({
      charge,
      unit,
      amountCents,
      dueDate,
      status: "open",
      installments: 1,
    });
    return `${unit} ${dollars(amountCents)} due ${dueDate}`;
  }

  pay(charge: string, on: string) {
    this.#table.find(charge).status = "paid";
    return `on ${on}`;
  }

  split(charge: string, installments: number) {
    const row = this.#table.find(charge);
    row.status = "split";
    row.installments = installments;
    return `${installments} installments`;
  }

  // Delinquency rule: a charge split into installments under an agreement is not debt
  unitInGoodStanding(unit: string, today: string): boolean {
    return !this.#table.rows.some(
      (r) => r.unit === unit && r.status === "open" && r.dueDate < today,
    );
  }
}
