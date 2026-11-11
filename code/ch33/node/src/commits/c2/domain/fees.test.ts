import { describe, expect, it } from "vitest";
import { calculateFees } from "./fees.ts";

const dues = { amount: 65_000, dueDate: "2026-11-05" };

describe("fees on the monthly dues", () => {
  it("on time, pays the dues amount", () => {
    expect(calculateFees(dues, "2026-11-05").total).toBe(65_000);
  });
  it("10 days late, a 2% late fee and 1% interest per month", () => {
    const f = calculateFees(dues, "2026-11-15");
    expect([f.lateFee, f.interest, f.total]).toEqual([1_300, 217, 66_517]);
  });
  it("5 days before the due date, a 3% discount", () => {
    const f = calculateFees(dues, "2026-10-31");
    expect([f.discount, f.total]).toEqual([1_950, 63_050]);
  });
  it("4 days before the due date, no discount", () => {
    expect(calculateFees(dues, "2026-11-01").discount).toBe(0);
  });
  it("the discount is rounded to the nearest cent", () => {
    const odd = { amount: 65_020, dueDate: "2026-11-05" };
    expect(calculateFees(odd, "2026-10-31").discount).toBe(1_951);
  });
});
