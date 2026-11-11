import { describe, expect, it } from "vitest";
import { isOn } from "../src/flags.ts";

const communities = Array.from({ length: 3_000 }, (_, i) => i + 1);
const turnedOn = (flag: string, percentage: number) =>
  communities.filter((c) => isOn(flag, { on: true, communities: [], percentage }, c));

describe("feature flags per community", () => {
  it("a percentage turns on close to that fraction of the communities", () => {
    const on = turnedOn("dedicated-cell", 10).length;
    expect(on).toBeGreaterThan(250);
    expect(on).toBeLessThan(350);
  });
  it("raising the percentage only adds communities", () => {
    const before = turnedOn("dedicated-cell", 10);
    const after = new Set(turnedOn("dedicated-cell", 20));
    expect(before.every((c) => after.has(c))).toBe(true);
  });
  it("different flags draw different groups", () => {
    const a = new Set(turnedOn("dedicated-cell", 10));
    const b = turnedOn("new-invoice", 10);
    expect(b.filter((c) => a.has(c)).length).toBeLessThan(b.length / 2);
  });
  it("the list turns on a community outside the percentage", () => {
    const rule = { on: true, communities: [7], percentage: 0 };
    expect(isOn("dedicated-cell", rule, 7)).toBe(true);
    expect(isOn("dedicated-cell", rule, 8)).toBe(false);
  });
  it("when off, it is on for no one, not even for those on the list", () => {
    const rule = { on: false, communities: [7], percentage: 100 };
    expect(isOn("dedicated-cell", rule, 7)).toBe(false);
  });
});
