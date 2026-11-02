// Sprout class (Feathers): the new rule is born outside the legacy code, in a new,
// small class with its own tests. The legacy code only gains a call.
export interface MonthBooking {
  unit: string;
  space: string;
  date: string;
}

// Bookings per unit, per space, in the same month
export const DEFAULT_LIMITS = { "party-room": 1, "grill-area": 2 };

export class MonthlyLimit {
  readonly #limits: Record<string, number>;

  constructor(limits: Record<string, number> = DEFAULT_LIMITS) {
    this.#limits = limits;
  }

  reached(request: MonthBooking, approved: readonly MonthBooking[]): boolean {
    const limit = this.#limits[request.space];
    if (limit === undefined) return false;
    const month = request.date.slice(0, 7);
    const made = approved.filter(
      (b) =>
        b.unit === request.unit &&
        b.space === request.space &&
        b.date.slice(0, 7) === month,
    ).length;
    return made >= limit;
  }
}
