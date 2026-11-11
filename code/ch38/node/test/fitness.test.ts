// The fitness functions and the simulated load
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { percentile, simulate } from "../src/fitness/load.ts";
import { ownData } from "../src/fitness/own-data.ts";

const commits = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/commits",
);

describe("own data", () => {
  it("approves the commit in which each module uses only its own tables", () => {
    expect(ownData(path.join(commits, "c1"))).toEqual([]);
  });

  it("finds the SQL in a string that reads another module's table", () => {
    expect(ownData(path.join(commits, "c2"))).toEqual([
      "bookings/rules.ts:6 reads billing.charges, owned by billing",
    ]);
  });
});

describe("simulated load", () => {
  it("adds the wait in the queue to the duration of the request", () => {
    // one connection, three 10 ms requests arriving together
    expect(simulate([0, 0, 0], [10, 10, 10], 1)).toEqual([10, 20, 30]);
    expect(simulate([0, 0, 0], [10, 10, 10], 3)).toEqual([10, 10, 10]);
  });

  it("computes the percentile by the nearest-rank method", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile([5, 1, 3], 50)).toBe(3);
  });
});
