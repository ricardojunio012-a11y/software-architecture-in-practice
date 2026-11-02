// Tests: each module tested through its own API, and Bookings tested without Billing.
import { describe, expect, it } from "vitest";
import { Billing } from "../src/after/modules/billing/api.ts";
import { ChargesTable } from "../src/after/modules/billing/internal/table.ts";
import { RejectionError, Bookings } from "../src/after/modules/bookings/api.ts";

describe("Billing", () => {
  it("an installment plan keeps the overdue unit in good standing", () => {
    const billing = new Billing(new ChargesTable());
    billing.issue("C-1", "B-101", 58685, "2026-02-10");
    expect(billing.unitInGoodStanding("B-101", "2026-03-02")).toBe(false);
    billing.split("C-1", 3);
    expect(billing.unitInGoodStanding("B-101", "2026-03-02")).toBe(true);
  });
});

describe("Bookings", () => {
  it("rejects a unit in arrears, using a fake Billing", () => {
    const inArrears = { unitInGoodStanding: () => false };
    const bookings = new Bookings(["party-room"], inArrears);
    expect(() =>
      bookings.book("R-1", "A-1", "party-room", "2026-03-14", "2026-03-02"),
    ).toThrow(RejectionError);
  });

  it("does not accept two bookings of the same space on the same day", () => {
    const bookings = new Bookings(["party-room"], { unitInGoodStanding: () => true });
    bookings.book("R-1", "A-1", "party-room", "2026-03-14", "2026-03-02");
    expect(() =>
      bookings.book("R-2", "A-2", "party-room", "2026-03-14", "2026-03-02"),
    ).toThrow("party-room already booked on 2026-03-14");
  });
});
