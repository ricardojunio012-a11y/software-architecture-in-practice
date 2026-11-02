// Open for extension, closed for modification: a new rule is a new class, handed in
// through the constructor. This class does not change.
import { Charge } from "./charge.ts";
import type { Entry, Rule, Unit } from "./types.ts";

export class ChargeCalculator {
  readonly #rules: readonly Rule[];

  constructor(rules: readonly Rule[]) {
    this.#rules = rules;
  }

  calculate(unit: Unit): Charge {
    const posted: Entry[] = [];
    for (const rule of this.#rules) {
      posted.push(...rule.apply(unit, posted));
    }
    return new Charge(unit.id, unit.resident.name, posted);
  }
}
