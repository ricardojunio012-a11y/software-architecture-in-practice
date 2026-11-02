// Tests: the subscribers are idempotent and independent of each other.
import { describe, expect, it } from "vitest";
import { eventFor } from "../src/events.ts";
import { Communications } from "../src/modules/communications.ts";
import { Bookings } from "../src/modules/bookings.ts";

const booking = {
  booking: "R-1",
  unit: "A-1",
  space: "party-room",
  date: "2026-03-14",
};
const event = eventFor({
  payment: "P-1",
  unit: "A-1",
  booking: "R-1",
  amountCents: 18000,
});

describe("subscribers", () => {
  it("confirm the booking and notify the resident", () => {
    const bookings = new Bookings([booking]);
    const communications = new Communications();
    bookings.onPaymentConfirmed(event);
    communications.onPaymentConfirmed(event);
    expect(bookings.lines()).toEqual(["R-1;A-1;party-room;2026-03-14;confirmed"]);
    expect(communications.notices).toHaveLength(1);
  });

  it("ignore the same event delivered twice", () => {
    const communications = new Communications();
    communications.onPaymentConfirmed(event);
    communications.onPaymentConfirmed(event);
    expect(communications.notices).toHaveLength(1);
    expect(communications.log[1]).toBe("communications ignored E-P-1 (duplicate)");
  });

  it("the event identifier is stable for the same payment", () => {
    const other = eventFor({
      payment: "P-1",
      unit: "A-1",
      booking: "R-1",
      amountCents: 18000,
    });
    expect(other.event).toBe(event.event);
  });
});
