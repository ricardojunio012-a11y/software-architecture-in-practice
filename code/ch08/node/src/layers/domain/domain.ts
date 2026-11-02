// Domain layer: the booking rules. It knows nothing about HTTP, JSON or databases.
export class RuleViolationError extends Error {}
export class NotFoundError extends Error {}

export function dollars(cents: number): string {
  const whole = String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${whole}.${String(cents % 100).padStart(2, "0")}`;
}

export interface Space {
  id: string;
  feeCents: number;
  minNoticeDays: number;
}

export interface Booking {
  readonly id: string;
  readonly unit: string;
  readonly date: string;
  readonly start: number;
  readonly end: number;
  readonly feeCents: number;
}

const days = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

export class Schedule {
  readonly space: Space;
  readonly #bookings: Booking[] = [];

  constructor(space: Space) {
    this.space = space;
  }

  book(
    id: string,
    unit: string,
    date: string,
    start: number,
    end: number,
    today: string,
  ) {
    if (end <= start) throw new RuleViolationError("invalid time slot");
    if (days(today, date) < this.space.minNoticeDays) {
      throw new RuleViolationError("minimum notice not met");
    }
    const conflict = this.#bookings.find(
      (b) => b.date === date && b.start < end && start < b.end,
    );
    if (conflict) throw new RuleViolationError(`time slot overlaps ${conflict.id}`);
    const weekday = new Date(date + "T00:00:00Z").getUTCDay();
    const base = this.space.feeCents;
    const weekend = weekday === 0 || weekday === 6;
    const fee = weekend ? base + Math.floor((base * 20 + 50) / 100) : base;
    const booking = { id, unit, date, start, end, feeCents: fee };
    this.#bookings.push(booking);
    return booking;
  }

  // Returns the cancellation fee in cents: 50% of the fee if less than 2 days are left
  cancel(id: string, today: string): number {
    const i = this.#bookings.findIndex((b) => b.id === id);
    if (i < 0) throw new NotFoundError("booking not found");
    const [booking] = this.#bookings.splice(i, 1);
    return days(today, booking.date) < 2
      ? Math.floor((booking.feeCents * 50 + 50) / 100)
      : 0;
  }

  has(id: string): boolean {
    return this.#bookings.some((b) => b.id === id);
  }

  bookings(): readonly Booking[] {
    return [...this.#bookings];
  }
}
