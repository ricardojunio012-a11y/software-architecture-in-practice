import { amountOf, entry } from "../types.ts";
import type { Entry, Rule, Unit } from "../types.ts";

// The board president does not pay the monthly dues (the reserve fund still applies).
export class BoardPresidentExemption implements Rule {
  apply(unit: Unit, posted: readonly Entry[]): Entry[] {
    if (!unit.boardPresident) return [];
    const dues = amountOf(posted, "dues");
    return [entry("exemption", "Board president exemption", -dues)];
  }
}
