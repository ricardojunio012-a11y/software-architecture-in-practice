// Value object: a period of use within one day. The end never comes before the start.
import { DomainError } from "./error.ts";

export class TimeSlot {
  readonly date: string;
  readonly start: number;
  readonly end: number;

  constructor(date: string, start: number, end: number) {
    if (end <= start) {
      throw new DomainError("invalid time slot: the end must be after the start");
    }
    this.date = date;
    this.start = start;
    this.end = end;
  }

  overlaps(other: TimeSlot): boolean {
    return this.date === other.date && this.start < other.end && other.start < this.end;
  }

  month(): string {
    return this.date.slice(0, 7);
  }

  daysSince(day: string): number {
    return Math.round((Date.parse(this.date) - Date.parse(day)) / 86400000);
  }

  isWeekend(): boolean {
    const weekday = new Date(this.date + "T00:00:00Z").getUTCDay();
    return weekday === 0 || weekday === 6;
  }

  // 2026-03-14 14:00-22:00
  toString(): string {
    const hh = (h: number) => String(h).padStart(2, "0") + ":00";
    return `${this.date} ${hh(this.start)}-${hh(this.end)}`;
  }
}
