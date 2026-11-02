// Repository: whoever uses the bookings does not know where they are stored.
import type { Booking } from "./state.ts";

export interface BookingRepository {
  save(booking: Booking): void;
  // Checks and saves in a single operation: in the database, a uniqueness constraint
  saveIfFree(booking: Booking): boolean;
  find(id: string): Booking | undefined;
  isTaken(space: string, date: string): boolean;
  countInMonth(unit: string, space: string, month: string): number;
}

// In memory for the lab; chapter 16 replaces it with a database.
// Keeps every booking; the queries count only the approved ones.
export class InMemoryRepository implements BookingRepository {
  readonly #bookings: Booking[] = [];

  save(booking: Booking): void {
    this.#bookings.push(booking);
  }

  saveIfFree(booking: Booking): boolean {
    const { space, date } = booking.request;
    if (this.isTaken(space.id, date)) return false;
    this.save(booking);
    return true;
  }

  find(id: string): Booking | undefined {
    return this.#bookings.find((b) => b.request.id === id);
  }

  isTaken(space: string, date: string): boolean {
    return this.#approved().some(
      ({ request: r }) => r.space.id === space && r.date === date,
    );
  }

  countInMonth(unit: string, space: string, month: string): number {
    return this.#approved().filter(
      ({ request: r }) =>
        r.unit.id === unit && r.space.id === space && r.date.startsWith(month),
    ).length;
  }

  #approved(): Booking[] {
    return this.#bookings.filter((b) => b.state === "approved");
  }
}
