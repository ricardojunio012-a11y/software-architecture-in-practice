// Integration event published by Billing. It carries the data the subscribers need
// (event-carried state transfer), so they do not have to query Billing.
export interface PaymentConfirmed {
  event: string;
  type: "PaymentConfirmed";
  payment: string;
  unit: string;
  booking: string;
  amountCents: number;
}

export interface Payment {
  payment: string;
  unit: string;
  booking: string;
  amountCents: number;
  failure?: "after-write" | "relay-before-mark";
}

// The event identifier is stable: the same payment always produces the same event
export function eventFor(p: Payment): PaymentConfirmed {
  return {
    event: `E-${p.payment}`,
    type: "PaymentConfirmed",
    payment: p.payment,
    unit: p.unit,
    booking: p.booking,
    amountCents: p.amountCents,
  };
}

export function dollars(cents: number): string {
  const whole = String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${whole}.${String(cents % 100).padStart(2, "0")}`;
}
