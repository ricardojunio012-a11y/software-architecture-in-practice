// In-memory outbound adapter: fast and dependency-free, good for tests.
// Everything is gone when the process ends.
import { NotFoundError, Schedule, type Space } from "../../domain/schedule.ts";
import type { ScheduleRepository } from "../../application/ports.ts";

export class InMemorySchedules implements ScheduleRepository {
  readonly #schedules = new Map<string, Schedule>();

  constructor(spaces: Space[]) {
    for (const s of spaces) this.#schedules.set(s.id, new Schedule(s));
  }

  async all() {
    return [...this.#schedules.values()];
  }

  async forSpace(space: string) {
    const schedule = this.#schedules.get(space);
    if (!schedule) throw new NotFoundError("space not found");
    return schedule;
  }

  async forBooking(booking: string) {
    for (const s of this.#schedules.values()) {
      if (s.bookings().some((b) => b.id === booking)) return s;
    }
    throw new NotFoundError("booking not found");
  }

  // The in-memory schedule is the changed object itself: there is nothing to write
  async save(_schedule: Schedule) {}
}
