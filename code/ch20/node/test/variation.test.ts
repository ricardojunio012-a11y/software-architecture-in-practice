// The model that varies: the same seed repeats the sequence, and rephrasing changes
// the form without changing the content.
import { describe, expect, it } from "vitest";
import { rephrase, seededRandom } from "../src/variable-model.ts";

describe("model that varies", () => {
  it("the same seed gives the same sequence of draws", () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("rephrases the form and keeps the content", () => {
    expect(rephrase("Quiet hours are from 10 p.m. to 8 a.m.")).toBe(
      "Quiet hours are from 10:00 PM to 8:00 AM",
    );
    expect(rephrase("The fee is $180.00.")).toBe("The fee is 180 dollars.");
  });
});
