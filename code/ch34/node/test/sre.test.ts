import { describe, expect, it } from "vitest";
import { RULES, Series, burnRate, episodes, firing } from "../src/sre.ts";

describe("burn rate", () => {
  it("is 1 when the errors are exactly what the SLO allows", () => {
    expect(burnRate(1, 1000, 0.999)).toBeCloseTo(1);
    expect(burnRate(72, 5000, 0.999)).toBeCloseTo(14.4);
    expect(burnRate(0, 0, 0.999)).toBe(0);
  });
});

describe("multiwindow alert", () => {
  const page = RULES[0]; // 1 h and 5 min, 14.4x, with an SLO of 99.9%

  it("fires only when both the long and the short window cross the threshold", () => {
    const s = new Series();
    for (let m = 0; m < 60; m++) s.add(1000, m < 50 ? 20 : 0);
    // the whole hour burned fast, but the last 10 minutes are clean
    expect(firing(s, page, 0.999, 50)).toBe(true);
    expect(firing(s, page, 0.999, 60)).toBe(false);
  });

  it("does not fire on a short spike that spends little of the budget", () => {
    const s = new Series();
    for (let m = 0; m < 60; m++) s.add(1000, m === 30 ? 300 : 0);
    expect(firing(s, page, 0.999, 31)).toBe(false);
  });

  it("counts an alert that returns soon after stopping as one notification", () => {
    const s = new Series();
    for (let m = 0; m < 100; m++) s.add(1, 0);
    const on = (m: number) => (m >= 10 && m < 20) || (m >= 30 && m < 40) || m >= 80;
    expect(episodes(s, on)).toEqual([
      { start: 10, end: 40 },
      { start: 80, end: 100 },
    ]);
  });
});
