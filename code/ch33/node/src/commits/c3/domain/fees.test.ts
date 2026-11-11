import { describe, expect, it, vi } from "vitest";
import { calculateFees } from "./fees.ts";

// To test the domain without a database, the test has to replace the whole module
vi.mock("../adapters/holidays-pg.ts", () => ({
  isHoliday: async (day: string) => day === "2026-12-25",
}));

const dues = { amount: 65_000, dueDate: "2026-11-05" };

describe("fees on the monthly dues", () => {
  it("on time, pays the dues amount", async () => {
    expect((await calculateFees(dues, "2026-11-05")).total).toBe(65_000);
  });
  it("10 days late, a 2% late fee and 1% interest per month", async () => {
    const f = await calculateFees(dues, "2026-11-15");
    expect([f.lateFee, f.interest, f.total]).toEqual([1_300, 217, 66_517]);
  });
  it("5 days before the due date, a 3% discount", async () => {
    const f = await calculateFees(dues, "2026-10-31");
    expect([f.discount, f.total]).toEqual([1_950, 63_050]);
  });
  it("the discount is rounded to the nearest cent", async () => {
    const odd = { amount: 65_020, dueDate: "2026-11-05" };
    expect((await calculateFees(odd, "2026-10-31")).discount).toBe(1_951);
  });
  it("a due date on a Friday holiday moves to Monday", async () => {
    const holiday = { amount: 65_000, dueDate: "2026-12-25" };
    expect((await calculateFees(holiday, "2026-12-28")).total).toBe(65_000);
  });
  it("a due date on a Sunday moves to Monday", async () => {
    const sunday = { amount: 65_000, dueDate: "2026-11-15" };
    expect((await calculateFees(sunday, "2026-11-16")).total).toBe(65_000);
  });
});
