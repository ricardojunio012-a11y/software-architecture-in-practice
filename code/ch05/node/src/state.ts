// State: what you can do with a booking depends on the state it is in.
// Each state is an object that knows which transitions it accepts; the booking
// only passes the call on.
import type { BookingRequest } from "./types.ts";

export abstract class State {
  abstract readonly name: string;

  // By default, no transition is allowed; each state allows its own
  approve(booking: Booking): void {
    this.rejectTransition("approve");
  }

  reject(booking: Booking): void {
    this.rejectTransition("reject");
  }

  cancel(booking: Booking): void {
    this.rejectTransition("cancel");
  }

  private rejectTransition(action: string): never {
    throw new Error(`cannot ${action} a ${this.name} booking`);
  }
}

class Pending extends State {
  readonly name = "pending";

  override approve(booking: Booking): void {
    booking.changeTo(APPROVED);
  }

  override reject(booking: Booking): void {
    booking.changeTo(REJECTED);
  }

  override cancel(booking: Booking): void {
    booking.changeTo(CANCELED);
  }
}

class Approved extends State {
  readonly name = "approved";

  override cancel(booking: Booking): void {
    booking.changeTo(CANCELED);
  }
}

class Rejected extends State {
  readonly name = "rejected";
}

class Canceled extends State {
  readonly name = "canceled";
}

// The states hold no data of their own: one instance of each is enough
const APPROVED = new Approved();
const REJECTED = new Rejected();
const CANCELED = new Canceled();

export class Booking {
  readonly request: BookingRequest;
  #state: State = new Pending();

  constructor(request: BookingRequest) {
    this.request = request;
  }

  get state(): string {
    return this.#state.name;
  }

  approve(): void {
    this.#state.approve(this);
  }

  reject(): void {
    this.#state.reject(this);
  }

  cancel(): void {
    this.#state.cancel(this);
  }

  // Used only by the states
  changeTo(state: State): void {
    this.#state = state;
  }
}
