// Chain of Responsibility: each stage checks one rule and, if the request passes,
// hands it to the next. The skeleton of evaluate() is a Template Method.
import type { BookingRepository } from "./repository.ts";
import { daysBetween, type BookingRequest, type Decision } from "./types.ts";

export abstract class Stage {
  #next: Stage | null = null;

  // Returns the next stage, for chaining: a.andThen(b).andThen(c)
  andThen(next: Stage): Stage {
    this.#next = next;
    return next;
  }

  evaluate(request: BookingRequest): Decision {
    const reason = this.check(request);
    if (reason) return { approved: false, reason };
    return this.#next ? this.#next.evaluate(request) : { approved: true };
  }

  // Each stage gives the reason for rejecting, or null if the request passed
  protected abstract check(request: BookingRequest): string | null;
}

export class UnitInGoodStanding extends Stage {
  protected check(request: BookingRequest): string | null {
    return request.unit.inArrears ? "unit in arrears" : null;
  }
}

export class MinimumNotice extends Stage {
  readonly #today: Date;

  constructor(today: Date) {
    super();
    this.#today = today;
  }

  protected check(request: BookingRequest): string | null {
    const minimum = request.space.minNoticeDays;
    if (daysBetween(this.#today, request.date) >= minimum) return null;
    return `minimum notice of ${minimum} days`;
  }
}

export class SpaceAvailable extends Stage {
  readonly #bookings: BookingRepository;

  constructor(bookings: BookingRepository) {
    super();
    this.#bookings = bookings;
  }

  protected check(request: BookingRequest): string | null {
    const taken = this.#bookings.isTaken(request.space.id, request.date);
    return taken ? "space already booked on this date" : null;
  }
}

export class MonthlyLimit extends Stage {
  readonly #bookings: BookingRepository;

  constructor(bookings: BookingRepository) {
    super();
    this.#bookings = bookings;
  }

  protected check(request: BookingRequest): string | null {
    const { unit, space, date } = request;
    const made = this.#bookings.countInMonth(unit.id, space.id, date.slice(0, 7));
    return made < space.monthlyLimit ? null : "monthly booking limit reached";
  }
}
