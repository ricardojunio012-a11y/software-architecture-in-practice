// Aggregate: the schedule of a space is the consistency boundary. The rules that
// involve several bookings (no overlaps, a limit per unit) can only be guaranteed by
// whoever knows all of them. Nobody outside changes a booking without going through
// here.
import { Money } from "./money.ts";
import { DomainError } from "./error.ts";
import type { DomainEvent } from "./events.ts";
import type { TimeSlot } from "./time-slot.ts";
import { Booking } from "./booking.ts";

export interface UsagePolicy {
  readonly fee: Money;
  readonly minNoticeDays: number;
  readonly monthlyLimit: number;
}

const WEEKEND_SURCHARGE_PERCENT = 20;
const CANCELLATION_FEE_PERCENT = 50;
const FREE_CANCELLATION_DAYS = 2;

export class Schedule {
  readonly space: string;
  readonly #policy: UsagePolicy;
  readonly #bookings: Booking[] = [];
  #events: DomainEvent[] = [];

  constructor(space: string, policy: UsagePolicy) {
    this.space = space;
    this.#policy = policy;
  }

  book(id: string, unit: string, slot: TimeSlot, today: string): Booking {
    if (slot.daysSince(today) < this.#policy.minNoticeDays) {
      throw new DomainError("minimum notice not met");
    }
    const conflict = this.active().find((b) => b.slot.overlaps(slot));
    if (conflict) throw new DomainError(`time slot overlaps ${conflict.id}`);
    const thisMonth = this.active().filter(
      (b) => b.unit === unit && b.slot.month() === slot.month(),
    );
    if (thisMonth.length >= this.#policy.monthlyLimit) {
      throw new DomainError("unit's monthly limit reached");
    }
    const booking = new Booking(id, unit, slot, this.#feeFor(slot));
    this.#bookings.push(booking);
    this.#events.push({
      type: "BookingConfirmed",
      booking: id,
      space: this.space,
      slot,
      unit,
      fee: booking.fee,
    });
    return booking;
  }

  cancel(id: string, today: string): Money {
    const booking = this.#bookings.find((b) => b.id === id);
    if (!booking) throw new DomainError("booking not found");
    booking.cancel();
    const lastMinute = booking.slot.daysSince(today) < FREE_CANCELLATION_DAYS;
    const cancellationFee = lastMinute
      ? booking.fee.percent(CANCELLATION_FEE_PERCENT)
      : Money.ZERO;
    this.#events.push({ type: "BookingCanceled", booking: id, cancellationFee });
    return cancellationFee;
  }

  has(id: string): boolean {
    return this.#bookings.some((b) => b.id === id);
  }

  active(): readonly Booking[] {
    return this.#bookings.filter((b) => b.isActive);
  }

  // Whoever saves the aggregate collects the events to publish them afterward
  collectEvents(): DomainEvent[] {
    const events = this.#events;
    this.#events = [];
    return events;
  }

  #feeFor(slot: TimeSlot): Money {
    const fee = this.#policy.fee;
    if (!slot.isWeekend()) return fee;
    return fee.add(fee.percent(WEEKEND_SURCHARGE_PERCENT));
  }
}
