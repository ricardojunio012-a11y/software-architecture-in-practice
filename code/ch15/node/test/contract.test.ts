// Contract tests. The first one is the test that breaks the build when someone
// changes openapi/v1.yaml in a way that current clients cannot handle.
import { describe, expect, it } from "vitest";
import { compareContracts } from "../src/contract/compatibility.ts";
import { readContract } from "../src/contract/openapi.ts";
import { validateResponse } from "../src/contract/validate.ts";

const current = readContract("/data/openapi/v1.yaml");
const published = readContract("/data/openapi/published/v1.yaml");

describe("contract", () => {
  it("the current contract is compatible with the published one", () => {
    const breaks = compareContracts(published, current).filter((c) => !c.compatible);
    expect(breaks).toEqual([]);
  });

  it("renaming a response field is incompatible", () => {
    const proposal = readContract("/data/input/proposals/b-rename.yaml");
    const breaks = compareContracts(published, proposal).filter((c) => !c.compatible);
    expect(breaks.map((c) => c.text)).toEqual([
      "GET /v1/communities/{community}/charges 200: " +
        "field removed: data[].amountCents",
    ]);
  });

  it("a response with the wrong type fails the check", () => {
    const body = {
      data: [
        {
          id: "CH-02",
          unit: "102",
          dueDate: "2026-10-10",
          amountCents: "450.00",
          status: "open",
        },
      ],
      next: null,
    };
    const path = "/v1/communities/C-01/charges";
    const type = "application/json";
    expect(validateResponse(current, "GET", path, 200, type, body)).toEqual([
      "GET /v1/communities/{community}/charges 200: " +
        "$.data[0].amountCents: expected integer, got string",
    ]);
  });
});
