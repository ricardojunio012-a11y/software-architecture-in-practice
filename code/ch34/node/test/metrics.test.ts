import { describe, expect, it } from "vitest";
import { bucketPercentile } from "../src/metrics.ts";

describe("percentile estimated from the buckets", () => {
  it("interpolates inside the bucket where the percentile falls", () => {
    // 100 measurements: 50 up to 0.1 s, 40 from 0.1 to 0.5 s, 10 from 0.5 to 1 s
    const bounds = [0.1, 0.5, 1];
    const counts = [50, 40, 10, 0];
    expect(bucketPercentile(bounds, counts, 0.5)).toBeCloseTo(0.1);
    expect(bucketPercentile(bounds, counts, 0.95)).toBeCloseTo(0.75);
  });
});
