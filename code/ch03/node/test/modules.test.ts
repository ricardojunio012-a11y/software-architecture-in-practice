// Tests: the hidden coupling of "before" and the isolation of "after".
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { config } from "../src/before/config/config.ts";
import {
  calculateAll,
  charges,
  generateOutput,
} from "../src/before/services/services.ts";
import { calculateCharges } from "../src/after/charges/index.ts";
import { delinquencyReport } from "../src/after/delinquency/index.ts";

const today = new Date("2026-03-02T00:00:00Z");
// Input: /data/input in the container; outside it, the chapter folder
const file = fs.existsSync("/data/input/billing.json")
  ? "/data/input/billing.json"
  : new URL("../../input/billing.json", import.meta.url);
const data = JSON.parse(fs.readFileSync(file, "utf8"));

describe("before: content coupling", () => {
  it("the delinquency report reorders another module's list of charges", () => {
    config.today = today;
    config.data = data;
    calculateAll();
    const originalOrder = charges.map((c) => c.unit.id).join(",");
    generateOutput("delinquency");
    expect(charges.map((c) => c.unit.id).join(",")).not.toBe(originalOrder);
  });
});

describe("after: isolated modules", () => {
  it("the delinquency report does not change the charges it receives", () => {
    const list = calculateCharges(
      data.community.monthlyExpensesCents,
      data.units,
      today,
    );
    const before = list.map((c) => c.unit).join(",");
    delinquencyReport("Test", today, list);
    expect(list.map((c) => c.unit).join(",")).toBe(before);
  });

  it("calculates the late fee and interest without global configuration", () => {
    const [carol] = calculateCharges(485000, [data.units[2]], today);
    expect([carol.daysLate, carol.lateFee, carol.interest]).toEqual([20, 1335, 445]);
  });
});
