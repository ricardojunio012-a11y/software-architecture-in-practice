// Public interface of the charges module: the other modules import only from here.
import { monthLabel } from "../shared/dates.ts";
import { dollars, shareOf } from "../shared/money.ts";
import { lateCharges, reserveFund } from "./rules.ts";

export interface Charge {
  readonly unit: string;
  readonly resident: string;
  readonly dues: number;
  readonly reserve: number;
  readonly arrears: number;
  readonly daysLate: number;
  readonly lateFee: number;
  readonly interest: number;
  readonly total: number;
}

interface Unit {
  id: string;
  shareMillionths: number;
  resident: { name: string };
  pastDue: { amountCents: number; dueDate: string } | null;
}

export function calculateCharges(
  expenses: number,
  units: Unit[],
  today: Date,
): readonly Charge[] {
  return units.map((u) => {
    const dues = shareOf(expenses, u.shareMillionths);
    const reserve = reserveFund(dues);
    const arrears = u.pastDue?.amountCents ?? 0;
    const l = u.pastDue
      ? lateCharges(arrears, u.pastDue.dueDate, today)
      : { days: 0, lateFee: 0, interest: 0 };
    const total = dues + reserve + arrears + l.lateFee + l.interest;
    return {
      unit: u.id,
      resident: u.resident.name,
      dues,
      reserve,
      arrears,
      daysLate: l.days,
      lateFee: l.lateFee,
      interest: l.interest,
      total,
    };
  });
}

export function chargeReport(
  community: string,
  today: Date,
  charges: readonly Charge[],
) {
  const lines = [`# Charges ${monthLabel(today)} - ${community}`];
  lines.push("unit;resident;dues;reserve;arrears;late_fee;interest;total");
  for (const c of charges) {
    const amounts = [c.dues, c.reserve, c.arrears, c.lateFee, c.interest, c.total];
    lines.push([c.unit, c.resident, ...amounts.map(dollars)].join(";"));
  }
  return lines.join("\n") + "\n";
}
