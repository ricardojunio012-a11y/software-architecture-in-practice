// Repository: one per aggregate. It saves the whole schedule, never a single booking.
import { Schedule, type UsagePolicy } from "../domain/schedule.ts";
import { DomainError } from "../domain/error.ts";

export interface ScheduleRepository {
  forSpace(space: string): Schedule;
  forBooking(booking: string): Schedule;
  save(schedule: Schedule): void;
  all(): readonly Schedule[];
}

// In memory in the lab; chapter 16 keeps the schedules in a database
export class InMemorySchedules implements ScheduleRepository {
  readonly #schedules = new Map<string, Schedule>();

  constructor(policies: Map<string, UsagePolicy>) {
    for (const [space, policy] of policies) {
      this.#schedules.set(space, new Schedule(space, policy));
    }
  }

  forSpace(space: string): Schedule {
    const schedule = this.#schedules.get(space);
    if (!schedule) throw new DomainError(`unknown space: ${space}`);
    return schedule;
  }

  forBooking(booking: string): Schedule {
    const schedule = [...this.#schedules.values()].find((s) => s.has(booking));
    if (!schedule) throw new DomainError("booking not found");
    return schedule;
  }

  save(schedule: Schedule): void {
    this.#schedules.set(schedule.space, schedule);
  }

  all(): readonly Schedule[] {
    return [...this.#schedules.values()];
  }
}
