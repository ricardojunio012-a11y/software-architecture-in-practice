// Integration tests: the repository against a real PostgreSQL, in a container.
import { describe, expect, it } from "vitest";
import { PostgresNotices } from "../src/communications/postgres.ts";

const url = process.env.DATABASE_URL;

describe.skipIf(!url)("integration: notices in PostgreSQL", () => {
  it("records a notice and finds it later", async () => {
    const { notices, close } = await PostgresNotices.connect(url!);
    expect(await notices.alreadySent("E-1")).toBe(false);
    await notices.record("E-1", "payment received");
    expect(await notices.alreadySent("E-1")).toBe(true);
    await close();
  });

  it("the database rejects the same notice twice", async () => {
    const { notices, close } = await PostgresNotices.connect(url!);
    await notices.record("E-1", "payment received");
    await expect(notices.record("E-1", "payment received")).rejects.toThrow();
    await close();
  });
});
