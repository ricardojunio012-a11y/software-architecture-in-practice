// Rules for calculating the monthly dues: reads no file and sends nothing.
import { daysSince } from "./period.ts";
import { shareOf, percentOf } from "./money.ts";

export interface Resident {
  name: string;
  email: string;
  phone?: string;
  channel: string;
}

export interface Unit {
  id: string;
  shareMillionths: number;
  resident: Resident;
  paymentMethod: string;
  pastDue: { amountCents: number; dueDate: string } | null;
}

export interface Charge {
  unit: Unit;
  dues: number;
  reserve: number;
  arrears: number;
  lateFee: number;
  interest: number;
  total: number;
}

const RESERVE_FUND = 10; // % of the dues
const LATE_FEE = 2; // % of the past-due balance (set by the CC&Rs)

// 1% a month, prorated by the days late
export function lateInterest(cents: number, days: number): number {
  return Math.floor((cents * days + 1500) / 3000);
}

export function calculateCharge(
  expensesCents: number,
  unit: Unit,
  today: Date,
): Charge {
  const dues = shareOf(expensesCents, unit.shareMillionths);
  const reserve = percentOf(dues, RESERVE_FUND);
  let arrears = 0;
  let lateFee = 0;
  let interest = 0;
  if (unit.pastDue) {
    arrears = unit.pastDue.amountCents;
    lateFee = percentOf(arrears, LATE_FEE);
    interest = lateInterest(arrears, daysSince(unit.pastDue.dueDate, today));
  }
  return {
    unit,
    dues,
    reserve,
    arrears,
    lateFee,
    interest,
    total: dues + reserve + arrears + lateFee + interest,
  };
}
