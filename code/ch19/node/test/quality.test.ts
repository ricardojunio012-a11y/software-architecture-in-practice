// Pseudonymization, and the test that looks for personal data in the clear in the
// analytics database.
import { DuckDBInstance } from "@duckdb/node-api";
import { describe, expect, it } from "vitest";
import { pseudonym } from "../src/pseudonym.ts";
import { noPersonalData } from "../src/quality.ts";

describe("personal data", () => {
  it("the pseudonym is stable and does not reveal the tax ID", () => {
    const a = pseudonym("key", "123456789");
    expect(a).toBe(pseudonym("key", "123456789"));
    expect(a).not.toContain("123456789");
    expect(pseudonym("another key", "123456789")).not.toBe(a);
  });

  it("flags a tax ID in the clear in any table", async () => {
    const con = await (await DuckDBInstance.create(":memory:")).connect();
    await con.run("CREATE TABLE contacts AS SELECT '123456789' AS document");
    expect(await noPersonalData(con)).toMatch(/^FAILED.*1 values/);
  });
});
