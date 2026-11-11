import { describe, expect, it } from "vitest";
import { costWithCommitment, profile } from "../src/commitment.ts";
import {
  databaseMultiplier,
  installationNodes,
  installations,
  monthlyCost,
  total,
} from "../src/model.ts";

describe("steps", () => {
  it("the database doubles in size when it goes past its capacity", () => {
    expect(databaseMultiplier(3000)).toBe(1);
    expect(databaseMultiplier(4001)).toBe(2);
    expect(databaseMultiplier(30_000)).toBe(8);
  });

  it("every installation has at least two nodes, one in each zone", () => {
    expect(installationNodes(400)).toBe(2);
    expect(installationNodes(30_000)).toBe(20);
  });
});

describe("architectures", () => {
  it("the installations add up to all the communities", () => {
    for (const arch of ["pool", "cells", "silos"] as const) {
      const sum = installations(arch, 30_000).reduce((s, i) => s + i.communities, 0);
      expect(sum).toBe(30_000);
    }
  });

  it("the silos set apart 20% of the communities in groups of up to 400", () => {
    const list = installations("silos", 3000);
    expect(list.map((i) => i.communities)).toEqual([2400, 400, 200]);
  });

  it("a fixed line does not change with 10 times more communities", () => {
    const fixed = (n: number) =>
      monthlyCost("pool", n).filter((l) => l.behavior === "fixed");
    expect(total(fixed(30_000))).toBe(total(fixed(3000)));
  });

  it("a linear line grows exactly 10 times", () => {
    const linear = (n: number) =>
      monthlyCost("cells", n).find((l) => l.name === "logs and traces")!.value;
    expect(linear(30_000) / linear(3000)).toBeCloseTo(10);
  });
});

describe("commitment", () => {
  it("committing the base usage is cheaper than committing nothing", () => {
    const hours = profile();
    const nothing = costWithCommitment(hours, 0, 0.0599);
    const base = costWithCommitment(hours, 2, 0.0599);
    const peak = costWithCommitment(hours, 6, 0.0599);
    expect(base).toBeLessThan(nothing);
    expect(peak).toBeGreaterThan(nothing);
  });
});
