// The sprout class tests: the new rule is tested alone, without the legacy code.
import { describe, expect, it } from "vitest";
import { MonthlyLimit } from "../src/step6/limit.ts";

const partyRoom = (unit: string, date: string) => ({ unit, space: "party-room", date });

describe("monthly booking limit (sprout class)", () => {
  const limit = new MonthlyLimit();

  it("declines a second party room booking for the same unit in the same month", () => {
    const made = [partyRoom("A-101", "2026-03-14")];
    expect(limit.reached(partyRoom("A-101", "2026-03-28"), made)).toBe(true);
  });

  it("does not count another month, another unit, or another space", () => {
    const made = [
      partyRoom("A-101", "2026-02-28"),
      partyRoom("B-101", "2026-03-14"),
      { unit: "A-101", space: "grill-area", date: "2026-03-07" },
    ];
    expect(limit.reached(partyRoom("A-101", "2026-03-28"), made)).toBe(false);
  });

  it("the grill area allows two per month; a space with no limit allows all", () => {
    const grill = (date: string) => ({
      unit: "A-101",
      space: "grill-area",
      date,
    });
    const two = [grill("2026-03-07"), grill("2026-03-14")];
    expect(limit.reached(grill("2026-03-21"), [two[0]])).toBe(false);
    expect(limit.reached(grill("2026-03-21"), two)).toBe(true);
    const pool = { unit: "A-101", space: "pool", date: "2026-03-21" };
    expect(limit.reached(pool, [pool, pool])).toBe(false);
  });
});
