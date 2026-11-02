// Data layer: where the schedules are stored. Today, in memory; in chapter 16,
// in a database. The layers above do not notice the change.
import { Schedule, NotFoundError, type Space } from "../domain/domain.ts";

export class ScheduleRepository {
  readonly #schedules = new Map<string, Schedule>();

  constructor(spaces: Space[]) {
    for (const s of spaces) this.#schedules.set(s.id, new Schedule(s));
  }

  all(): Schedule[] {
    return [...this.#schedules.values()];
  }

  forSpace(id: string): Schedule {
    const schedule = this.#schedules.get(id);
    if (!schedule) throw new NotFoundError("space not found");
    return schedule;
  }

  forBooking(id: string): Schedule {
    const schedule = this.all().find((s) => s.has(id));
    if (!schedule) throw new NotFoundError("booking not found");
    return schedule;
  }
}
