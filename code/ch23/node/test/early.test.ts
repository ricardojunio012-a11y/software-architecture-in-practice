// Early expiration: far from the expiry, it almost never recomputes; close to it,
// almost always; after it, always.
import { describe, expect, it } from "vitest";
import { shouldRecompute, seededRandom } from "../src/early.ts";

function rate(now: number) {
  const draw = seededRandom(1);
  const times = Array.from({ length: 1000 }, () =>
    shouldRecompute(now, 60, 2, 1, draw()),
  );
  return times.filter(Boolean).length / 1000;
}

describe("probabilistic early expiration", () => {
  it("the chance of recomputing grows close to the expiry", () => {
    expect(rate(30)).toBeLessThan(0.01);
    expect(rate(59)).toBeGreaterThan(0.3);
    expect(rate(60)).toBe(1);
  });
});
