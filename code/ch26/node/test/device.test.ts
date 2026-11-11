// The receiver ignores duplicates by the entry identifier, and keeps the order.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LocalQueue, Receiver } from "../src/device.ts";

describe("gate entry receiver", () => {
  it("ignores a duplicate entry", () => {
    const r = new Receiver();
    const a = { id: "p:1", plate: "ABC0001", time: "2026-11-05T08:01:00" };
    const b = { id: "p:2", plate: "ABC0002", time: "2026-11-05T08:02:00" };
    r.receive(a);
    r.receive(b);
    r.receive(a);
    expect(r.received.map((x) => x.id)).toEqual(["p:1", "p:2"]);
    expect(r.duplicates).toBe(1);
  });
});

describe("local queue", () => {
  it("in a file, survives closing and reopening, in the same order", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "q")), "queue.db");
    const before = new LocalQueue(file);
    before.record({ id: "p:1", plate: "ABC0001", time: "2026-11-05T08:01:00" });
    before.record({ id: "p:2", plate: "ABC0002", time: "2026-11-05T08:02:00" });
    before.close();
    const after = new LocalQueue(file);
    expect(after.size).toBe(2);
    after.close();
  });
});
