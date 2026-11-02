// Internal billing rules, used only by the module itself.
import { daysBetween } from "../shared/dates.ts";
import { percentOf } from "../shared/money.ts";

const RESERVE_FUND = 10; // % of the dues
const LATE_FEE = 2; // % of the arrears

export function reserveFund(dues: number): number {
  return percentOf(dues, RESERVE_FUND);
}

export function lateCharges(arrears: number, dueDate: string, today: Date) {
  const days = daysBetween(dueDate, today);
  const interest = Math.floor((arrears * days + 1500) / 3000); // 1% a month, prorated
  return { days, lateFee: percentOf(arrears, LATE_FEE), interest };
}
