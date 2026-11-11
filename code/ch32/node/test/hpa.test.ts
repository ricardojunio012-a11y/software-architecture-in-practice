import { describe, expect, it } from "vitest";
import { HpaController, recommend } from "../src/hpa.ts";

const ready = (n: number, usage: number) => Array(n).fill(usage);

describe("the HPA calculation", () => {
  it("follows the formula: ceil(current × current value / desired value)", () => {
    // 4 replicas at 90% with a 60% target: 4 × 1.5 = 6
    expect(recommend({ current: 4, readyUsage: ready(4, 90), notReady: 0 }, 60)).toBe(
      6,
    );
    // 10 replicas at 30%: 10 × 0.5 = 5
    expect(recommend({ current: 10, readyUsage: ready(10, 30), notReady: 0 }, 60)).toBe(
      5,
    );
  });

  it("does not change anything within the 10% tolerance", () => {
    expect(recommend({ current: 4, readyUsage: ready(4, 65), notReady: 0 }, 60)).toBe(
      4,
    );
  });

  it("counts replicas still starting as 0% when scaling up", () => {
    // 4 ready at 120% and 4 starting: (480 / 8) / 60 = 1, no further scale-up
    expect(recommend({ current: 8, readyUsage: ready(4, 120), notReady: 4 }, 60)).toBe(
      8,
    );
    // 4 ready at 150% and 2 starting: (600 / 6) / 60 = 1.67 → ceil(1.67 × 6) = 10
    expect(recommend({ current: 6, readyUsage: ready(4, 150), notReady: 2 }, 60)).toBe(
      10,
    );
  });
});

describe("the controller", () => {
  const cfg = { min: 3, max: 30, target: 60, scaleDownWindow: 300 };

  it("scales up at most to double or 4 more per cycle, whichever is larger", () => {
    const hpa = new HpaController(cfg);
    expect(hpa.cycle(0, { current: 3, readyUsage: ready(3, 160), notReady: 0 })).toBe(
      7,
    );
    expect(hpa.cycle(0, { current: 10, readyUsage: ready(10, 160), notReady: 0 })).toBe(
      20,
    );
  });

  it("scales down only after the stabilization window", () => {
    const hpa = new HpaController(cfg);
    const m = (usage: number) => ({
      current: 10,
      readyUsage: ready(10, usage),
      notReady: 0,
    });
    expect(hpa.cycle(0, m(60))).toBe(10);
    expect(hpa.cycle(15, m(30))).toBe(10); // the 10 is still in the window
    expect(hpa.cycle(300, m(30))).toBe(5); // the one from t = 0 left the window
  });

  it("respects the minimum and the maximum", () => {
    const hpa = new HpaController(cfg);
    expect(hpa.cycle(0, { current: 28, readyUsage: ready(28, 160), notReady: 0 })).toBe(
      30,
    );
    expect(
      hpa.cycle(0, { current: 3, readyUsage: ready(3, 60), notReady: 0 }, 20),
    ).toBe(20);
  });
});
