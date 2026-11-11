// The N+1 fix with a fake database that counts the queries: the fixed version runs a
// single query, whatever the number of units.
import { describe, expect, it } from "vitest";
import { type Querier, delinquencyFixed, delinquencyN1 } from "../src/delinquency.ts";

class FakeDb implements Querier {
  queries = 0;

  async query(sql: string) {
    this.queries++;
    if (sql.includes("JOIN")) return { rows: [] };
    if (sql.startsWith("SELECT id, code")) {
      return {
        rows: Array.from({ length: 50 }, (_, i) => ({ id: i, code: `U-${i}` })),
      };
    }
    return { rows: [{ total: 0 }] };
  }
}

describe("delinquency route", () => {
  it("N+1 runs one query per unit; the fixed version, just one", async () => {
    const n1 = new FakeDb();
    await delinquencyN1(n1, 1);
    expect(n1.queries).toBe(51);
    const fixed = new FakeDb();
    await delinquencyFixed(fixed, 1);
    expect(fixed.queries).toBe(1);
  });
});
