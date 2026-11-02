// Tests: the Communications module is the same inside and outside the monolith.
import { describe, expect, it } from "vitest";
import { Communications } from "../src/communications.ts";

describe("Communications", () => {
  it("sends each notice only once, even when asked again", () => {
    const communications = new Communications();
    expect(communications.send("E-P-001", "payment received")).toBe(true);
    expect(communications.send("E-P-001", "payment received")).toBe(false);
    expect(communications.send("E-P-002", "payment received")).toBe(true);
  });
});
