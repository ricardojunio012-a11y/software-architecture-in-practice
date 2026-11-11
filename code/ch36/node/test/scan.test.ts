import { describe, expect, it } from "vitest";
import { scanText } from "../src/scan.ts";

describe("secret scan", () => {
  it("finds the secret and shows only its start", () => {
    const [f] = scanText("x.ts", 'const apiToken = "abcd1234efgh";');
    expect(f.rule).toBe("hardcoded secret");
    expect(f.sample).toBe("abcd…");
  });

  it("finds the password inside a connection URL", () => {
    const findings = scanText("x.ts", 'const u = "postgres://app:S3cr3tPw@db/x";');
    expect(findings.map((f) => f.rule)).toEqual(["URL with password"]);
  });

  it("does not flag reading the secret at run time", () => {
    expect(scanText("x.ts", 'const secret = readSecret("integration");')).toEqual([]);
    expect(scanText("x.ts", "const u = `pg://app:${secret()}@db/x`;")).toEqual([]);
  });
});
