// Commit c3: a due date on a weekend or holiday moves to the next business day.
// The shortcut: the domain imports the database adapter to learn the holidays.
import { isHoliday } from "../adapters/holidays-pg.ts";

export type Charge = { amount: number; dueDate: string };
export type Fees = {
  lateFee: number;
  interest: number;
  discount: number;
  total: number;
};

const DAY = 86_400_000;

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY);
}

function addDay(date: string): string {
  return new Date(Date.parse(date) + DAY).toISOString().slice(0, 10);
}

async function effectiveDueDate(date: string): Promise<string> {
  let day = date;
  for (;;) {
    const weekday = new Date(Date.parse(day)).getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !(await isHoliday(day))) return day;
    day = addDay(day);
  }
}

export async function calculateFees(c: Charge, paymentDate: string) {
  const late = daysBetween(await effectiveDueDate(c.dueDate), paymentDate);
  if (late <= -5) {
    const discount = Math.round(c.amount * 0.03);
    return { lateFee: 0, interest: 0, discount, total: c.amount - discount };
  }
  if (late <= 0) return { lateFee: 0, interest: 0, discount: 0, total: c.amount };
  const lateFee = Math.round(c.amount * 0.02);
  const interest = Math.round((c.amount * 0.01 * late) / 30);
  return { lateFee, interest, discount: 0, total: c.amount + lateFee + interest };
}
