// Optimistic locking with a fake database: if the version changed between the read and
// the write, the booking is rolled back and rejected.
import type pg from "pg";
import { describe, expect, it } from "vitest";
import { bookOptimistic } from "../src/book.ts";

function fakeDb(versionChanged: boolean) {
  const commands: string[] = [];
  const db = {
    async query(sql: string) {
      commands.push(sql.split(" ")[0]);
      if (sql.startsWith("SELECT version")) return { rows: [{ version: 7 }] };
      if (sql.startsWith("SELECT 1")) return { rows: [] };
      if (sql.startsWith("UPDATE"))
        return { rowCount: versionChanged ? 0 : 1, rows: [] };
      return { rows: [], rowCount: 1 };
    },
  };
  return { db: db as unknown as pg.Client, commands };
}

describe("optimistic locking", () => {
  const request = {
    resident: "Anna",
    start: "2026-11-07 12:00",
    end: "2026-11-07 16:00",
  };

  it("commits when the version stays the same", async () => {
    const { db, commands } = fakeDb(false);
    expect(await bookOptimistic(db, request)).toBe(true);
    expect(commands.at(-1)).toBe("COMMIT");
  });

  it("rolls back and rejects when another booking changed the version", async () => {
    const { db, commands } = fakeDb(true);
    expect(await bookOptimistic(db, request)).toBe(false);
    expect(commands.at(-1)).toBe("ROLLBACK");
  });
});
