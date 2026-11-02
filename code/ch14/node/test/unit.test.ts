// Unit tests: the service's rule, with no network and no database. They run in
// milliseconds.
import { describe, expect, it } from "vitest";
import {
  Communications,
  InMemoryNotices,
  InvalidDataError,
} from "../src/communications/domain.ts";

describe("unit: Communications", () => {
  it("sends a new notice", async () => {
    const communications = new Communications(new InMemoryNotices());
    expect(await communications.send("E-1", "payment received")).toBe("sent");
  });

  it("recognizes a duplicate notice", async () => {
    const communications = new Communications(new InMemoryNotices());
    await communications.send("E-1", "payment received");
    expect(await communications.send("E-1", "payment received")).toBe("duplicate");
  });

  it("rejects a notice without text", async () => {
    const communications = new Communications(new InMemoryNotices());
    await expect(communications.send("E-1", "")).rejects.toThrow(InvalidDataError);
  });
});
