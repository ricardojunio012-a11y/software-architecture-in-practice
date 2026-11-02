// Tests: what the before version cannot test and what the after version isolates.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { issueCharges } from "../src/before/issuing.ts";
import { ChargeCalculator } from "../src/after/billing/calculator.ts";
import type { Charge } from "../src/after/billing/charge.ts";
import * as exemption from "../src/after/billing/rules/board-president-exemption.ts";
import * as discount from "../src/after/billing/rules/early-payment-discount.ts";
import { MonthlyDues } from "../src/after/billing/rules/monthly-dues.ts";
import { PastDueBalance } from "../src/after/billing/rules/past-due-balance.ts";
import { ReserveFund } from "../src/after/billing/rules/reserve-fund.ts";
import { entry, type Rule, type Unit } from "../src/after/billing/types.ts";
import type { PaymentGateway } from "../src/after/issuing/gateway.ts";
import { IssuingService } from "../src/after/issuing/issuing-service.ts";
import { AlphaBankClient } from "../src/external/alpha-bank.ts";

const today = new Date("2026-03-02T00:00:00Z");
// Input: /data/input in the container; outside it, the chapter folder
const file = fs.existsSync("/data/input/community.json")
  ? "/data/input/community.json"
  : new URL("../../input/community.json", import.meta.url);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const units: Unit[] = data.units;
const expenses = data.community.monthlyExpensesCents;
const deadlines = { dueDate: "2026-03-10", discountUntil: "2026-03-05" };

// Test double: implements the interface and only records what it received
class InMemoryGateway implements PaymentGateway {
  readonly name = "in memory";
  readonly received: Charge[] = [];

  register(charge: Charge) {
    this.received.push(charge);
    return { unit: charge.unit, identifier: "test" };
  }
}

describe("before: calculation and bank glued together", () => {
  it("calculating the charges also creates invoices at the bank", () => {
    const before = AlphaBankClient.issued;
    issueCharges(data, today);
    expect(AlphaBankClient.issued - before).toBe(8);
  });
});

describe("after: rules and gateway behind abstractions", () => {
  it("a new rule goes in without changing the calculator", () => {
    const extraFee: Rule = {
      apply: () => [entry("assessment", "Special assessment", 5000)],
    };
    const calculator = new ChargeCalculator([new MonthlyDues(expenses), extraFee]);
    expect(calculator.calculate(units[0]).total).toBe(60625 + 5000);
  });

  it("the board president is exempt from dues and pays the reserve fund", () => {
    const calculator = new ChargeCalculator([
      new MonthlyDues(expenses),
      new ReserveFund(10),
      new exemption.BoardPresidentExemption(),
    ]);
    const president = units.find((u) => u.boardPresident)!;
    expect(calculator.calculate(president).total).toBe(6790);
  });

  it("a unit in arrears does not get the early-payment discount", () => {
    const calculator = new ChargeCalculator([
      new MonthlyDues(expenses),
      new PastDueBalance(),
      new discount.EarlyPaymentDiscount(5, deadlines.discountUntil),
    ]);
    const current = units.find((u) => u.id === "A-101")!;
    const inArrears = units.find((u) => u.id === "A-201")!;
    expect(calculator.calculate(current).discount).toBe(3031);
    const noDiscount = calculator.calculate(inArrears).entries;
    expect(noDiscount.some((e) => e.conditional)).toBe(false);
  });

  it("issuing works with any gateway, without a real bank", () => {
    const gateway = new InMemoryGateway();
    const calculator = new ChargeCalculator([new MonthlyDues(expenses)]);
    const before = AlphaBankClient.issued;
    new IssuingService(calculator, gateway, deadlines).issue(units);
    expect(gateway.received.map((c) => c.unit)).toHaveLength(8);
    expect(AlphaBankClient.issued).toBe(before);
  });
});
