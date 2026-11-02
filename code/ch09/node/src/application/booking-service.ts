// The use cases implement the inbound port and use the outbound port. They do not know
// whether HTTP or the terminal called them, nor where the schedules are kept.
import { dollars, slot } from "../domain/schedule.ts";
import type { BookingRequest, BookingUseCases, ScheduleRepository } from "./ports.ts";

export class BookingService implements BookingUseCases {
  readonly #schedules: ScheduleRepository;

  constructor(schedules: ScheduleRepository) {
    this.#schedules = schedules;
  }

  async listSpaces() {
    return (await this.#schedules.all()).map((s) => ({
      id: s.space.id,
      fee: dollars(s.space.feeCents),
      minNoticeDays: s.space.minNoticeDays,
    }));
  }

  async book(r: BookingRequest) {
    const schedule = await this.#schedules.forSpace(r.space);
    const b = schedule.book(r.booking, r.unit, r.date, r.start, r.end, r.requestedOn);
    await this.#schedules.save(schedule);
    return {
      booking: b.id,
      status: "confirmed" as const,
      fee: dollars(b.feeCents),
    };
  }

  async cancel(booking: string, requestedOn: string) {
    const schedule = await this.#schedules.forBooking(booking);
    const fee = schedule.cancel(booking, requestedOn);
    await this.#schedules.save(schedule);
    return { booking, status: "canceled" as const, cancellationFee: dollars(fee) };
  }

  async bookingsForSpace(space: string) {
    const schedule = await this.#schedules.forSpace(space);
    return schedule.bookings().map((b) => ({
      booking: b.id,
      unit: b.unit,
      slot: slot(b),
    }));
  }
}
