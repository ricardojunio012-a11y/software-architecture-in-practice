// The decision log validator
import { describe, expect, it } from "vitest";
import { readAdr, SECTIONS, validate } from "../src/adr.ts";

function adr(number: string, fields: string[], sections = SECTIONS): string {
  return [
    `# ADR-${number}: A decision`,
    "",
    ...fields.map((f) => `- ${f}`),
    "",
    ...sections.flatMap((s) => [`## ${s}`, "", "Text.", ""]),
  ].join("\n");
}
const accepted = ["Status: accepted", "Date: 2026-01-10"];

describe("validate", () => {
  it("accepts a supersession recorded in both directions", () => {
    const old = readAdr(
      "adr-001-a.md",
      adr("001", ["Status: superseded by ADR-002", "Date: 2026-01-10"]),
    );
    const next = readAdr(
      "adr-002-b.md",
      adr("002", [...accepted, "Supersedes: ADR-001"]),
    );
    expect(validate([old, next])).toEqual([]);
  });

  it("points out a one-way supersession", () => {
    const old = readAdr("adr-001-a.md", adr("001", accepted));
    const next = readAdr(
      "adr-002-b.md",
      adr("002", [...accepted, "Supersedes: ADR-001"]),
    );
    expect(validate([old, next])).toEqual([
      'ADR-002: supersedes ADR-001, which is still "accepted"',
    ]);
  });

  it("points out a title and a file with different numbers", () => {
    const a = readAdr("adr-029-a.md", adr("028", accepted));
    expect(validate([a])).toEqual(["adr-029-a.md: the title says ADR-028"]);
  });

  it("points out a missing section and sections out of order", () => {
    const missing = readAdr("adr-001-a.md", adr("001", accepted, SECTIONS.slice(0, 4)));
    const order = readAdr(
      "adr-002-b.md",
      adr("002", accepted, [...SECTIONS].reverse()),
    );
    expect(validate([missing, order])).toEqual([
      'adr-001-a.md: missing section "When to revisit"',
      "adr-002-b.md: sections out of order",
    ]);
  });

  it("rejects a fitness function linked to an ADR that is not in force", () => {
    const a = readAdr(
      "adr-001-a.md",
      adr("001", ["Status: proposed", "Date: 2026-01-10"]),
    );
    expect(validate([a], [{ fn: "f", adr: 1 }])).toEqual([
      'function f: ADR-001 is "proposed"',
    ]);
  });
});
