// The token bucket: it lets the burst through, rejects the excess, and refills over
// time.
import { describe, expect, it } from "vitest";
import { TokenBucket } from "../src/bucket.ts";

describe("token bucket", () => {
  it("allows the burst, rejects the excess, and gains tokens over time", () => {
    const bucket = new TokenBucket(10, 20);
    const burst = Array.from({ length: 10 }, () => bucket.allows(0));
    expect(burst.every(Boolean)).toBe(true);
    expect(bucket.allows(0)).toBe(false);
    // 20 tokens per second: one token every 50 ms
    expect(bucket.allows(49)).toBe(false);
    expect(bucket.allows(99)).toBe(true);
  });
});
