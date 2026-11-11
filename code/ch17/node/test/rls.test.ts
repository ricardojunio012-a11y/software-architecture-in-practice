// Row-Level Security in PostgreSQL: a query with no filter sees only the
// transaction's community, and writing to another community is rejected. The
// management company sees the communities it manages, and only those.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { asCommunity, asManagementCompany, connect } from "../src/db.ts";

describe.skipIf(!process.env.DATABASE_URL)("RLS per community", () => {
  it("isolates reads and writes by community", async () => {
    const admin = await connect(process.env.DATABASE_URL!);
    await admin.query(fs.readFileSync("/data/sql/schema.sql", "utf8"));
    await admin.query(fs.readFileSync("/data/sql/rls.sql", "utf8"));
    const app = await connect(process.env.APP_DATABASE_URL!);
    const { rows } = await asCommunity(app, 15, () =>
      app.query("SELECT DISTINCT community_id FROM charges"),
    );
    expect(rows).toEqual([{ community_id: 15 }]);
    const write = asCommunity(app, 15, () =>
      app.query(
        "INSERT INTO charges " +
          "(community_id, unit, resident, amount_cents, status) " +
          "VALUES (20, 'B-1', 'Iris Moore', 61000, 'open')",
      ),
    );
    await expect(write).rejects.toMatchObject({ code: "42501" });
    await Promise.all([admin.end(), app.end()]);
  });

  it("a management company sees only the communities it manages", async () => {
    const admin = await connect(process.env.DATABASE_URL!);
    await admin.query(fs.readFileSync("/data/sql/schema.sql", "utf8"));
    await admin.query(fs.readFileSync("/data/sql/rls.sql", "utf8"));
    const app = await connect(process.env.APP_DATABASE_URL!);
    const { rows } = await asManagementCompany(app, 3, () =>
      app.query("SELECT DISTINCT community_id FROM charges ORDER BY 1"),
    );
    expect(rows).toEqual([{ community_id: 12 }, { community_id: 15 }]);
    await Promise.all([admin.end(), app.end()]);
  });
});
