// Commit c4: the US federal holidays in a list, by year (observed dates)
import type { Calendar } from "../domain/calendar.ts";

const HOLIDAYS: Record<string, string[]> = {
  "2026": [
    "01-01",
    "01-19",
    "02-16",
    "05-25",
    "06-19",
    "07-03",
    "09-07",
    "10-12",
    "11-11",
    "11-26",
    "12-25",
  ],
};

export class FixedHolidays implements Calendar {
  isBusinessDay(day: string): boolean {
    const weekday = new Date(Date.parse(day)).getUTCDay();
    if (weekday === 0 || weekday === 6) return false;
    const list = HOLIDAYS[day.slice(0, 4)];
    if (!list) throw new Error(`holidays for ${day.slice(0, 4)} not registered`);
    return !list.includes(day.slice(5));
  }
}
