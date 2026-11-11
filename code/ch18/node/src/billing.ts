// Morada's Billing model: a payment received, in the language of the domain.
// Nothing here knows about Nacha, positions, or the bank's status codes.

export interface PaymentReceived {
  charge: string;
  paidOn: string; // YYYY-MM-DD
  amountPaidCents: number;
  feeCents: number;
}

const dollars = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });

export function describe(p: PaymentReceived): string {
  return (
    `${p.charge} paid on ${p.paidOn}: $${dollars(p.amountPaidCents)}, ` +
    `fee $${dollars(p.feeCents)}`
  );
}
