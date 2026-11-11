// Bookings asks Billing, through its API, whether the unit is in good standing
import type { Db } from "../../../db.ts";
import { unitInGoodStanding } from "../billing/api.ts";

export async function canBook(db: Db, unit: number): Promise<boolean> {
  return unitInGoodStanding(db, unit);
}
