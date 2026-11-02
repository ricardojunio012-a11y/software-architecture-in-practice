// Bookings subscribes to PaymentConfirmed: the booking awaiting payment is confirmed.
// The subscriber is idempotent, because the broker delivers "at least once".
import type { PaymentConfirmed } from "../events.ts";

interface Booking {
  booking: string;
  unit: string;
  space: string;
  date: string;
  status: string;
}

export class Bookings {
  readonly #bookings = new Map<string, Booking>();
  readonly #processed = new Set<string>();
  readonly log: string[] = [];

  constructor(initial: Omit<Booking, "status">[]) {
    for (const b of initial) {
      this.#bookings.set(b.booking, { ...b, status: "awaiting payment" });
    }
  }

  onPaymentConfirmed(e: PaymentConfirmed) {
    if (this.#processed.has(e.event)) {
      this.log.push(`bookings ignored ${e.event} (duplicate)`);
      return;
    }
    this.#processed.add(e.event);
    this.#bookings.get(e.booking)!.status = "confirmed";
    this.log.push(`bookings received ${e.event}: ${e.booking} confirmed`);
  }

  lines(): string[] {
    return [...this.#bookings.values()].map(
      (b) => `${b.booking};${b.unit};${b.space};${b.date};${b.status}`,
    );
  }
}
