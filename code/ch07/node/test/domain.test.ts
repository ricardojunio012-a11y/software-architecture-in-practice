// Tests: what the anemic model allows and what the rich model prevents.
import { describe, expect, it } from "vitest";
import { bookings, Booking } from "../src/before/model.ts";
import { Schedule } from "../src/after/domain/schedule.ts";
import { Money } from "../src/after/domain/money.ts";
import { DomainError } from "../src/after/domain/error.ts";
import { TimeSlot } from "../src/after/domain/time-slot.ts";

const policy = {
  fee: Money.fromCents(15000),
  minNoticeDays: 2,
  monthlyLimit: 1,
};

describe("before: anemic model", () => {
  it("any code saves an overlapping booking, bypassing the rules", () => {
    const a = Object.assign(new Booking(), {
      id: "X-1",
      space: "party-room",
      date: "2026-03-14",
    });
    const b = Object.assign(new Booking(), {
      id: "X-2",
      space: "party-room",
      date: "2026-03-14",
    });
    Object.assign(a, { start: 14, end: 22 });
    Object.assign(b, { start: 20, end: 23 });
    bookings.push(a, b);
    const overlapping = bookings.filter((r) => r.id.startsWith("X-"));
    expect(overlapping).toHaveLength(2); // the invalid state was accepted
  });
});

describe("after: rich model", () => {
  it("the schedule rejects an overlapping time slot", () => {
    const schedule = new Schedule("party-room", policy);
    schedule.book("R-1", "A-101", new TimeSlot("2026-03-14", 14, 22), "2026-03-02");
    expect(() =>
      schedule.book("R-2", "A-202", new TimeSlot("2026-03-14", 20, 23), "2026-03-02"),
    ).toThrow("time slot overlaps R-1");
  });

  it("there is no time slot that ends before it starts", () => {
    expect(() => new TimeSlot("2026-03-14", 18, 16)).toThrow(DomainError);
  });

  it("money rounds half up and is compared by value", () => {
    expect(Money.fromCents(18001).percent(50).toString()).toBe("$90.01");
    expect(Money.fromCents(9000).equals(Money.fromCents(9000))).toBe(true);
  });

  it("a last-minute cancellation yields a fee and an event; a second fails", () => {
    const schedule = new Schedule("party-room", policy);
    schedule.book("R-1", "A-101", new TimeSlot("2026-03-14", 14, 22), "2026-03-02");
    schedule.collectEvents();
    expect(schedule.cancel("R-1", "2026-03-13").toString()).toBe("$90.00");
    expect(schedule.collectEvents().map((e) => e.type)).toEqual(["BookingCanceled"]);
    expect(() => schedule.cancel("R-1", "2026-03-13")).toThrow("is not confirmed");
    expect(() => schedule.cancel("R-99", "2026-03-13")).toThrow("not found");
  });
});
