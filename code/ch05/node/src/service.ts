// Receives the request, consults the approval chain, stores and announces the result.
import type { Stage } from "./approval.ts";
import type { EventBus } from "./events.ts";
import type { BookingRepository } from "./repository.ts";
import { Booking } from "./state.ts";
import type { BookingRequest, Decision } from "./types.ts";

export class BookingService {
  readonly #approval: Stage;
  readonly #bookings: BookingRepository;
  readonly #events: EventBus;

  constructor(approval: Stage, bookings: BookingRepository, events: EventBus) {
    this.#approval = approval;
    this.#bookings = bookings;
    this.#events = events;
  }

  submit(request: BookingRequest): Decision {
    const booking = new Booking(request);
    let decision = this.#approval.evaluate(request);
    // The chain saw the space free, but another request may have saved since:
    // saving checks again, in a single operation (step 6 of the lab)
    if (decision.approved && !this.#bookings.saveIfFree(booking)) {
      decision = { approved: false, reason: "space already booked on this date" };
    }
    if (decision.approved) {
      booking.approve();
    } else {
      booking.reject();
      this.#bookings.save(booking);
    }
    const type = decision.approved ? "BookingConfirmed" : "BookingRejected";
    this.#events.publish({ type, request, reason: decision.reason });
    return decision;
  }

  // The state decides whether the booking can be canceled
  cancel(id: string): string {
    const booking = this.#bookings.find(id);
    if (!booking) throw new Error(`booking ${id} not found`);
    const before = booking.state;
    booking.cancel();
    return `${before} -> ${booking.state}`;
  }
}
