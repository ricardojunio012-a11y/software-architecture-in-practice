// The charge of one unit. Information expert (GRASP): whoever has the entries is the
// one who calculates the totals.
import type { Entry } from "./types.ts";

export class Charge {
  readonly unit: string;
  readonly resident: string;
  readonly entries: readonly Entry[];

  constructor(unit: string, resident: string, entries: readonly Entry[]) {
    this.unit = unit;
    this.resident = resident;
    this.entries = Object.freeze([...entries]);
  }

  get total(): number {
    return this.#sum(false);
  }

  // Conditional discount, as a positive amount
  get discount(): number {
    return -this.#sum(true);
  }

  #sum(conditional: boolean): number {
    return this.entries
      .filter((e) => e.conditional === conditional)
      .reduce((s, e) => s + e.amount, 0);
  }
}
