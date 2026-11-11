// Commit c0, the version in production: a 2% late fee and 1% interest per month,
// per day late. Amounts in cents; dates in YYYY-MM-DD format.
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

export function calculateFees(c: Charge, paymentDate: string): Fees {
  const late = daysBetween(c.dueDate, paymentDate);
  if (late <= 0) return { lateFee: 0, interest: 0, discount: 0, total: c.amount };
  const lateFee = Math.round(c.amount * 0.02);
  const interest = Math.round((c.amount * 0.01 * late) / 30);
  return { lateFee, interest, discount: 0, total: c.amount + lateFee + interest };
}
