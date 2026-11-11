import { describe, expect, it } from "vitest";
import type { Calendar } from "./calendar.ts";
import { calculateFees } from "./fees.ts";

// A test calendar: weekends and the December 25 holiday
const calendar: Calendar = {
  isBusinessDay: (day) =>
    ![0, 6].includes(new Date(day).getUTCDay()) && day !== "2026-12-25",
};
const dues = { amount: 65_000, dueDate: "2026-11-05" };

describe("fees on the monthly dues", () => {
  it("on time, pays the dues amount", () => {
    expect(calculateFees(dues, "2026-11-05", calendar).total).toBe(65_000);
  });
  it("10 days late, a 2% late fee and 1% interest per month", () => {
    const f = calculateFees(dues, "2026-11-15", calendar);
    expect([f.lateFee, f.interest, f.total]).toEqual([1_300, 217, 66_517]);
  });
  it("5 days before the due date, a 3% discount", () => {
    const f = calculateFees(dues, "2026-10-31", calendar);
    expect([f.discount, f.total]).toEqual([1_950, 63_050]);
  });
  it("the discount is rounded to the nearest cent", () => {
    const odd = { amount: 65_020, dueDate: "2026-11-05" };
    expect(calculateFees(odd, "2026-10-31", calendar).discount).toBe(1_951);
  });
  it("a due date on a Friday holiday moves to Monday", () => {
    const holiday = { amount: 65_000, dueDate: "2026-12-25" };
    expect(calculateFees(holiday, "2026-12-28", calendar).total).toBe(65_000);
  });
  it("a due date on a Sunday moves to Monday", () => {
    const sunday = { amount: 65_000, dueDate: "2026-11-15" };
    expect(calculateFees(sunday, "2026-11-16", calendar).total).toBe(65_000);
  });
});
