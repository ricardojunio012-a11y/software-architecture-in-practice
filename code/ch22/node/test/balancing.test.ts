// The decisions of the load-balancing algorithms, with servers in known states.
import { describe, expect, it } from "vitest";
import {
  keyHash,
  leastConnections,
  seededRandom,
  twoChoices,
} from "../src/balancing.ts";

const servers = [{ inFlight: 5 }, { inFlight: 1 }, { inFlight: 3 }];

describe("load-balancing algorithms", () => {
  it("least connections picks the least busy server", () => {
    expect(leastConnections(servers, 0, Math.random)).toBe(1);
  });

  it("the hash always sends the same community to the same server", () => {
    expect(keyHash(servers, 7, Math.random)).toBe(keyHash(servers, 7, Math.random));
  });

  it("two choices favors the least busy server", () => {
    // With two servers, it keeps the busier one only if it draws it twice: 25%
    const two = [{ inFlight: 5 }, { inFlight: 1 }];
    const random = seededRandom(1);
    const choices = Array.from({ length: 1000 }, () => twoChoices(two, 0, random));
    const onLeastBusy = choices.filter((s) => s === 1).length;
    expect(onLeastBusy).toBeGreaterThan(700);
  });
});
