// Communications subscribes to the same event and notifies the resident. It does not
// know Bookings: everything it needs came inside the event.
import { dollars, type PaymentConfirmed } from "../events.ts";

export class Communications {
  readonly #processed = new Set<string>();
  readonly notices: string[] = [];
  readonly log: string[] = [];

  onPaymentConfirmed(e: PaymentConfirmed) {
    if (this.#processed.has(e.event)) {
      this.log.push(`communications ignored ${e.event} (duplicate)`);
      return;
    }
    this.#processed.add(e.event);
    const amount = dollars(e.amountCents);
    const payment = `payment ${e.payment} of ${amount} received`;
    this.notices.push(`${e.unit}: ${payment}; booking ${e.booking} confirmed`);
    this.log.push(`communications received ${e.event}: notified ${e.unit}`);
  }
}
