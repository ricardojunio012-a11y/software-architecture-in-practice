// The ports of the hexagon. The inside defines both; the outside adapts.
import type { Schedule } from "../domain/schedule.ts";

// Inbound port: what the system offers, whoever drives it
export interface BookingUseCases {
  listSpaces(): Promise<ListedSpace[]>;
  book(request: BookingRequest): Promise<Confirmation>;
  cancel(booking: string, requestedOn: string): Promise<Cancellation>;
  bookingsForSpace(space: string): Promise<ListedBooking[]>;
}

// Outbound port: what the system needs to keep the schedules
export interface ScheduleRepository {
  all(): Promise<Schedule[]>;
  forSpace(space: string): Promise<Schedule>;
  forBooking(booking: string): Promise<Schedule>;
  save(schedule: Schedule): Promise<void>;
}

export interface BookingRequest {
  booking: string;
  unit: string;
  space: string;
  date: string;
  start: number;
  end: number;
  requestedOn: string;
}

export interface ListedSpace {
  id: string;
  fee: string;
  minNoticeDays: number;
}

export interface Confirmation {
  booking: string;
  status: "confirmed";
  fee: string;
}

export interface Cancellation {
  booking: string;
  status: "canceled";
  cancellationFee: string;
}

export interface ListedBooking {
  booking: string;
  unit: string;
  slot: string;
}
