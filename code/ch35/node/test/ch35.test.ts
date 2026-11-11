// The availability math and the load balancer, without a network.
import { describe, expect, it } from "vitest";
import { Balancer, type Replica } from "../src/balancer.ts";
import * as av from "../src/availability.ts";

describe("composite availability", () => {
  it("in series, the availabilities multiply", () => {
    expect(av.inSeries([0.999, 0.999, 0.999])).toBeCloseTo(0.997003, 6);
  });

  it("in parallel, the unavailabilities multiply", () => {
    expect(av.inParallel([0.99, 0.99])).toBeCloseTo(0.9999, 6);
  });

  it("a shared component limits the set", () => {
    const together = av.withShared(0.999, [0.995, 0.995]);
    expect(together).toBeLessThan(0.999);
    expect(together).toBeLessThan(av.inParallel([0.995, 0.995]));
  });

  it("converts to hours down per year", () => {
    expect(av.hoursDownPerYear(0.999)).toBeCloseTo(8.76, 2);
  });
});

describe("load balancer", () => {
  const a: Replica = { name: "a", zone: "1" };
  const b: Replica = { name: "b", zone: "2" };
  const down = new Set<string>();
  const transport = async (r: Replica) => !down.has(r.name);

  it("rotates among the replicas", async () => {
    const seen: string[] = [];
    const lb = new Balancer([a, b], async (r) => (seen.push(r.name), true), false);
    for (let i = 0; i < 4; i++) await lb.request();
    expect(seen).toEqual(["a", "b", "a", "b"]);
  });

  it("without trying another, half the requests fail with a replica down", async () => {
    down.clear();
    down.add("a");
    const lb = new Balancer([a, b], transport, false);
    const r = await Promise.all([1, 2, 3, 4].map(() => lb.request()));
    expect(r.filter(Boolean)).toHaveLength(2);
  });

  it("trying the other, no request fails with one replica down", async () => {
    down.clear();
    down.add("a");
    const lb = new Balancer([a, b], transport, true);
    for (let i = 0; i < 4; i++) expect(await lb.request()).toBe(true);
  });

  it("with both down, trying the other does not help", async () => {
    down.clear();
    down.add("a").add("b");
    const lb = new Balancer([a, b], transport, true);
    expect(await lb.request()).toBe(false);
  });
});
