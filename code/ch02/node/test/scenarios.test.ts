// Tests of the scenario runner: they check the load and the evaluation, not the time.
import { describe, expect, it } from "vitest";
import { evaluate, run, syntheticCommunity } from "../src/scenarios.ts";

describe("syntheticCommunity", () => {
  it("creates the requested units, with shares that add up to 100%", () => {
    const { units } = syntheticCommunity(1, 40);
    expect(units).toHaveLength(40);
    expect(units.reduce((sum, u) => sum + u.shareMillionths, 0)).toBe(1000000);
    expect(units.filter((u) => u.pastDue !== null)).toHaveLength(5);
  });
});

describe("evaluate and run", () => {
  it("passes within the limit and fails above it", () => {
    expect(evaluate(59.9, 60)).toBe(true);
    expect(evaluate(60.1, 60)).toBe(false);
  });

  it("calculates one charge per unit and estimates the invoice creation", () => {
    const scenario = {
      id: "T",
      description: "test",
      communities: 3,
      unitsPerCommunity: 10,
      invoicesPerSecond: 10,
      limitSeconds: 2,
    };
    const r = run(scenario, new Date("2026-03-02T00:00:00Z"));
    expect(r.charges).toBe(30);
    expect(r.processorSeconds).toBe(3);
    expect(r.passed).toBe(false); // 3 s at the processor do not fit in 2 s
  });
});
