// The migrations run once each, in order, and a second run does nothing.
import { describe, expect, it } from "vitest";
import { connect, resetSchema } from "../src/db.ts";
import { applyMigrations } from "../src/migrations.ts";

describe.skipIf(!process.env.DATABASE_URL)("migrations", () => {
  it("apply each file only once, in order", async () => {
    const db = await connect(process.env.DATABASE_URL!);
    await resetSchema(db);
    expect(await applyMigrations(db, "/data/migrations")).toEqual([
      "001_charges.sql",
      "002_reserve_fund.sql",
      "003_delinquency_index.sql",
    ]);
    expect(await applyMigrations(db, "/data/migrations")).toEqual([]);
    await db.end();
  });
});
