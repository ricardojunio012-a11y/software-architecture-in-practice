// Commit c1: a 3% discount for paying at least 5 days before the due date.
// Amounts in cents; dates in YYYY-MM-DD format.
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
  if (late <= -5) {
    const discount = Math.round(c.amount * 0.03);
    return { lateFee: 0, interest: 0, discount, total: c.amount - discount };
  }
  if (late <= 0) return { lateFee: 0, interest: 0, discount: 0, total: c.amount };
  const lateFee = Math.round(c.amount * 0.02);
  const interest = Math.round((c.amount * 0.01 * late) / 30);
  return { lateFee, interest, discount: 0, total: c.amount + lateFee + interest };
}
