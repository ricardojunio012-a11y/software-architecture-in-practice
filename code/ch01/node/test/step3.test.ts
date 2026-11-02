// Unit tests for step 3: possible because the calculation was separated from the rest.
import { describe, expect, it } from "vitest";
import { generateBilling } from "../src/step3/application.ts";
import { calculateCharge, type Unit } from "../src/step3/calculation.ts";
import type { Notice, Notifier } from "../src/step3/notification.ts";
import { Invoice } from "../src/step3/payment.ts";

const today = new Date("2026-03-02T00:00:00Z");

// The fake: instead of sending, it keeps the notices in a list for the test to check
class FakeNotifier implements Notifier {
  readonly notices: Notice[] = [];

  notify(notice: Notice): void {
    this.notices.push(notice);
  }
}

function unit(extra: Partial<Unit> = {}): Unit {
  return {
    id: "A-101",
    shareMillionths: 125000,
    resident: { name: "Anna", email: "anna@example.com", channel: "email" },
    paymentMethod: "invoice",
    pastDue: null,
    ...extra,
  };
}

describe("calculateCharge", () => {
  it("splits the expenses by ownership share and adds a 10% reserve fund", () => {
    const c = calculateCharge(485000, unit(), today);
    expect(c.dues).toBe(60625);
    expect(c.reserve).toBe(6063);
    expect(c.total).toBe(66688);
  });

  it("charges a 2% late fee and 1% monthly interest prorated by days late", () => {
    const c = calculateCharge(
      485000,
      unit({ pastDue: { amountCents: 66750, dueDate: "2026-02-10" } }),
      today,
    );
    expect(c.lateFee).toBe(1335);
    expect(c.interest).toBe(445); // 20 days
    expect(c.total).toBe(66688 + 66750 + 1335 + 445);
  });
});

describe("generateBilling", () => {
  it("notifies each resident once, without sending anything for real", () => {
    const notifier = new FakeNotifier();
    const data = {
      community: {
        id: "test",
        name: "Test Community",
        monthlyExpensesCents: 100000,
      },
      units: [
        unit({ shareMillionths: 500000 }),
        unit({ id: "A-102", shareMillionths: 500000 }),
      ],
    };
    generateBilling(data, today, new Invoice(), notifier);
    const notices = notifier.notices;
    expect(notices.map((a) => a.charge.unit.id)).toEqual(["A-101", "A-102"]);
    expect(notices[0].payment.code).toBe("INV-test-202603-A-101-55000");
  });
});
