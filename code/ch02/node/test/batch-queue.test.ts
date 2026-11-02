// Tests of the batch queue simulation: same seed, same result.
import { describe, expect, it } from "vitest";
import { availableBy, percentile, simulate } from "../src/batch-queue.ts";

const assumptions = {
  id: "T",
  description: "test",
  invoices: 1000,
  invoicesPerFile: 250,
  invoicesPerSecond: 10,
  returnSeconds: 100,
  transientFailurePercent: 20,
  permanentRejectionEvery: 50,
  maxAttempts: 3,
  limitSeconds: 400,
  seed: 7,
};

describe("simulate", () => {
  it("naive: the tail goes past the limit and some invoices are never created", () => {
    const r = simulate(assumptions, false);
    expect([r.files, r.attempts, r.notCreated]).toEqual([12, 1246, 26]);
    expect(availableBy(r, 400)).toBe(968);
    expect(percentile(r, 1000, 500)).toBe(175);
    expect(percentile(r, 1000, 990)).toBeNull(); // p99 falls on the never created
  });

  it("adjusted: everything available within the limit, part of it by card", () => {
    const r = simulate(assumptions, true);
    expect([r.files, r.attempts, r.viaCard]).toEqual([11, 1199, 32]);
    expect(availableBy(r, 400)).toBe(1000);
    expect(percentile(r, 1000, 990)).toBe(357);
  });

  it("the same seed always gives the same result", () => {
    expect(simulate(assumptions, false)).toEqual(simulate(assumptions, false));
  });
});
