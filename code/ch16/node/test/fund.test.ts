// The reserve fund: formatting in dollars, and two simultaneous withdrawals with the
// fund row locked, which never leave the balance negative.
import { describe, expect, it } from "vitest";
import { connect, resetSchema } from "../src/db.ts";
import { balance, dollars, recordWithdrawal, setUpFund } from "../src/fund.ts";
import { applyMigrations } from "../src/migrations.ts";

describe("dollars", () => {
  it("formats cents with a dollar sign, thousands separator, and sign", () => {
    expect(dollars(100000)).toBe("$1,000.00");
    expect(dollars(-30000)).toBe("-$300.00");
    expect(dollars(5)).toBe("$0.05");
  });
});

describe.skipIf(!process.env.DATABASE_URL)("reserve fund in PostgreSQL", () => {
  it("simultaneous withdrawals with a lock never go negative", async () => {
    const url = process.env.DATABASE_URL!;
    const db = await connect(url);
    await resetSchema(db);
    await applyMigrations(db, "/data/migrations");
    await setUpFund(db);
    const a = await connect(url);
    const b = await connect(url);
    const results = await Promise.all([
      recordWithdrawal(a, 1, 70000, "gate repair"),
      recordWithdrawal(b, 1, 60000, "facade painting"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await balance(db, 1)).toBeGreaterThanOrEqual(0);
    await Promise.all([a.end(), b.end(), db.end()]);
  });
});
