// Service that holds every rule. The rules only apply if whoever changes the data
// remembers to go through here; nothing stops other code from changing bookings
// directly.
import { bookings, Booking, type Space } from "./model.ts";

function days(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
}

function format(cents: number): string {
  const whole = String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${whole}.${String(cents % 100).padStart(2, "0")}`;
}

function hours(start: number, end: number): string {
  const hh = (h: number) => String(h).padStart(2, "0") + ":00";
  return `${hh(start)}-${hh(end)}`;
}

export function book(c: any, space: Space, events: string[]): string {
  if (c.end <= c.start)
    return "rejected;invalid time slot: the end must be after the start";
  if (days(c.requestedOn, c.date) < space.minNoticeDays) {
    return "rejected;minimum notice not met";
  }
  for (const b of bookings) {
    const sameTime = b.date === c.date && b.start < c.end && c.start < b.end;
    if (b.space === c.space && b.status === "confirmed" && sameTime) {
      return `rejected;time slot overlaps ${b.id}`;
    }
  }
  const thisMonth = bookings.filter(
    (b) =>
      b.space === c.space &&
      b.unit === c.unit &&
      b.status === "confirmed" &&
      b.date.slice(0, 7) === c.date.slice(0, 7),
  );
  if (thisMonth.length >= space.monthlyLimit)
    return "rejected;unit's monthly limit reached";

  const weekday = new Date(c.date + "T00:00:00Z").getUTCDay();
  let fee = space.feeCents;
  if (weekday === 0 || weekday === 6) fee += Math.floor((fee * 20 + 50) / 100);
  const b = new Booking();
  Object.assign(b, { id: c.booking, unit: c.unit, space: c.space, date: c.date });
  Object.assign(b, { start: c.start, end: c.end, feeCents: fee });
  bookings.push(b);
  const slot = `${c.date} ${hours(c.start, c.end)}`;
  events.push(`BookingConfirmed;${b.id};${b.space};${slot};${b.unit};${format(fee)}`);
  return `confirmed;${format(fee)}`;
}

export function cancel(c: any, events: string[]): string {
  const b = bookings.find((x) => x.id === c.booking);
  if (!b) return "not canceled;booking not found";
  if (b.status !== "confirmed") return "not canceled;booking is not confirmed";
  b.status = "canceled";
  const fee =
    days(c.requestedOn, b.date) < 2 ? Math.floor((b.feeCents * 50 + 50) / 100) : 0;
  const detail = fee > 0 ? `cancellation fee ${format(fee)}` : "no cancellation fee";
  events.push(`BookingCanceled;${b.id};${detail}`);
  return `canceled;${detail}`;
}
