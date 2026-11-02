// Application service: translates a command into calls to the domain. It loads the
// aggregate, asks it to do the work, saves it and publishes the events. No business
// rule.
import { DomainError } from "../domain/error.ts";
import type { DomainEvent } from "../domain/events.ts";
import { TimeSlot } from "../domain/time-slot.ts";
import type { ScheduleRepository } from "./repository.ts";

export interface Command {
  type: "book" | "cancel";
  booking: string;
  requestedOn: string;
  unit?: string;
  space?: string;
  date?: string;
  start?: number;
  end?: number;
}

export interface Result {
  booking: string;
  command: string;
  status: string;
  detail: string;
}

export class BookingService {
  readonly #schedules: ScheduleRepository;
  readonly #publish: (event: DomainEvent) => void;

  constructor(schedules: ScheduleRepository, publish: (e: DomainEvent) => void) {
    this.#schedules = schedules;
    this.#publish = publish;
  }

  execute(c: Command): Result {
    try {
      return c.type === "book" ? this.#book(c) : this.#cancel(c);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      const status = c.type === "book" ? "rejected" : "not canceled";
      return { booking: c.booking, command: c.type, status, detail: error.message };
    }
  }

  #book(c: Command): Result {
    const slot = new TimeSlot(c.date!, c.start!, c.end!);
    const schedule = this.#schedules.forSpace(c.space!);
    const booking = schedule.book(c.booking, c.unit!, slot, c.requestedOn);
    this.#save(schedule);
    return {
      booking: c.booking,
      command: c.type,
      status: "confirmed",
      detail: booking.fee.toString(),
    };
  }

  #cancel(c: Command): Result {
    const schedule = this.#schedules.forBooking(c.booking);
    const fee = schedule.cancel(c.booking, c.requestedOn);
    this.#save(schedule);
    const detail = fee.cents > 0 ? `cancellation fee ${fee}` : "no cancellation fee";
    return { booking: c.booking, command: c.type, status: "canceled", detail };
  }

  #save(schedule: ReturnType<ScheduleRepository["forSpace"]>): void {
    this.#schedules.save(schedule);
    schedule.collectEvents().forEach(this.#publish);
  }
}
