// The center of the hexagon: the booking rules. Imports nothing outside the domain.
export class RuleViolatedError extends Error {}
export class NotFoundError extends Error {}

// $1,234.56
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

// 2026-03-14 14:00-22:00
export function slot(b: Booking): string {
  const hh = (h: number) => String(h).padStart(2, "0") + ":00";
  return `${b.date} ${hh(b.start)}-${hh(b.end)}`;
}

const days = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

export class Schedule {
  readonly space: Space;
  readonly #bookings: Booking[];

  // A repository that loads a saved schedule passes in the existing bookings
  constructor(space: Space, bookings: Booking[] = []) {
    this.space = space;
    this.#bookings = [...bookings];
  }

  book(
    id: string,
    unit: string,
    date: string,
    start: number,
    end: number,
    today: string,
  ): Booking {
    if (end <= start) throw new RuleViolatedError("invalid time slot");
    if (days(today, date) < this.space.minNoticeDays) {
      throw new RuleViolatedError("minimum notice not met");
    }
    const conflict = this.#bookings.find(
      (b) => b.date === date && b.start < end && start < b.end,
    );
    if (conflict) throw new RuleViolatedError(`time slot overlaps ${conflict.id}`);
    const weekday = new Date(date + "T00:00:00Z").getUTCDay();
    const base = this.space.feeCents;
    const weekend = weekday === 0 || weekday === 6;
    const fee = weekend ? base + Math.floor((base * 20 + 50) / 100) : base;
    const booking = { id, unit, date, start, end, feeCents: fee };
    this.#bookings.push(booking);
    return booking;
  }

  // Returns the cancellation fee in cents: 50% of the fee if less than 2 days remain
  cancel(id: string, today: string): number {
    const i = this.#bookings.findIndex((b) => b.id === id);
    if (i < 0) throw new NotFoundError("booking not found");
    const [b] = this.#bookings.splice(i, 1);
    return days(today, b.date) < 2 ? Math.floor((b.feeCents * 50 + 50) / 100) : 0;
  }

  // In date and time order, whatever the order in which they were stored
  bookings(): Booking[] {
    return [...this.#bookings].sort(
      (a, b) => a.date.localeCompare(b.date) || a.start - b.start,
    );
  }
}
