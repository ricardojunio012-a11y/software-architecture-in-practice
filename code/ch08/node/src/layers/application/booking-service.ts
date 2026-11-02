// Application layer: the use cases. It takes plain data, calls the domain and the
// repository, and returns plain data. It does not know HTTP exists.
import type { ScheduleRepository } from "../data/repository.ts";
import { dollars } from "../domain/domain.ts";

export interface BookingRequest {
  booking: string;
  unit: string;
  space: string;
  date: string;
  start: number;
  end: number;
  requestedOn: string;
}

const hour = (h: number) => `${String(h).padStart(2, "0")}:00`;

export class BookingService {
  readonly #schedules: ScheduleRepository;

  constructor(schedules: ScheduleRepository) {
    this.#schedules = schedules;
  }

  listSpaces() {
    return this.#schedules.all().map((s) => ({
      id: s.space.id,
      fee: dollars(s.space.feeCents),
      minNoticeDays: s.space.minNoticeDays,
    }));
  }

  book(r: BookingRequest) {
    const schedule = this.#schedules.forSpace(r.space);
    const b = schedule.book(r.booking, r.unit, r.date, r.start, r.end, r.requestedOn);
    return { booking: b.id, status: "confirmed", fee: dollars(b.feeCents) };
  }

  cancel(booking: string, on: string) {
    const fee = this.#schedules.forBooking(booking).cancel(booking, on);
    return { booking, status: "canceled", cancellationFee: dollars(fee) };
  }

  bookingsForSpace(space: string) {
    return this.#schedules
      .forSpace(space)
      .bookings()
      .map((b) => ({
        booking: b.id,
        unit: b.unit,
        slot: `${b.date} ${hour(b.start)}-${hour(b.end)}`,
      }));
  }
}
