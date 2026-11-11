// The entry point the rest of Morada calls: it wires the domain to the adapter
import { FixedHolidays } from "./adapters/fixed-holidays.ts";
import { type Charge, calculateFees } from "./domain/fees.ts";

const calendar = new FixedHolidays();

export function amountDue(c: Charge, paymentDate: string) {
  return calculateFees(c, paymentDate, calendar);
}
