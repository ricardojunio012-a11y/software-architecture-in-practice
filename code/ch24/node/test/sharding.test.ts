// The IDs with the shard inside and the router with logical shards.
import { describe, expect, it } from "vitest";
import { makeId, readId } from "../src/ids.ts";
import { Router } from "../src/router.ts";

describe("sharding", () => {
  it("the ID stores the moment, the logical shard, and the sequence", () => {
    const now = Date.UTC(2026, 9, 25, 12, 0, 0);
    const id = makeId(now, 7, 1500);
    expect(readId(id)).toEqual({
      createdAt: "2026-10-25T12:00:00.000Z",
      logicalShard: 7,
      sequence: 1500 % 1024,
    });
    // IDs created later are larger: the order of the IDs is the order of creation
    expect(makeId(now + 1, 0, 0) > id).toBe(true);
  });

  it("moving a logical shard changes the destination of its communities only", () => {
    const router = new Router({
      0: "a",
      1: "a",
      2: "b",
      3: "b",
      4: "c",
      5: "c",
      6: "a",
      7: "a",
      8: "b",
      9: "b",
      10: "c",
      11: "c",
    });
    router.move(7, "c");
    expect(router.physical(7)).toBe("c");
    expect(router.physical(19)).toBe("c"); // 19 % 12 = 7
    expect(router.physical(6)).toBe("a");
  });
});
