// Unit tests for the three changes, made on the refactored code.
import { describe, expect, it } from "vitest";
import { generateBilling } from "../src/step4/application.ts";
import { calculateCharge, type Unit } from "../src/step4/calculation.ts";
import type { Notice, Notifier } from "../src/step4/notification.ts";
import { Invoice } from "../src/step4/payment.ts";
import { Card } from "../src/step4/card.ts";

const today = new Date("2026-03-02T00:00:00Z");

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

describe("early-payment discount", () => {
  it("gives 5% off the dues when there is no past-due balance", () => {
    const c = calculateCharge(485000, unit(), today);
    expect(c.totalBy5th).toBe(66688 - 3031);
  });

  it("gives no discount when there is a past-due balance", () => {
    const c = calculateCharge(
      485000,
      unit({ pastDue: { amountCents: 1000, dueDate: "2026-02-10" } }),
      today,
    );
    expect(c.totalBy5th).toBeNull();
  });
});

describe("choice of payment method and channel", () => {
  it("uses card and SMS when the unit asks for them", () => {
    const byChannel: Record<string, string[]> = { email: [], sms: [] };
    const fake = (channel: string): Notifier => ({
      notify: (notice: Notice) => byChannel[channel].push(notice.payment.code),
    });
    const data = {
      community: {
        id: "test",
        name: "Test Community",
        monthlyExpensesCents: 100000,
      },
      units: [
        unit({ shareMillionths: 500000 }),
        unit({
          id: "A-102",
          shareMillionths: 500000,
          paymentMethod: "card",
          resident: {
            name: "Beth",
            email: "beth@example.com",
            phone: "+1 555-0100",
            channel: "sms",
          },
        }),
      ],
    };
    generateBilling(
      data,
      today,
      { invoice: new Invoice(), card: new Card() },
      { email: fake("email"), sms: fake("sms") },
    );
    expect(byChannel.email).toEqual(["INV-test-202603-A-101-55000"]);
    expect(byChannel.sms).toEqual(["CARD-test-202603-A-102-55000"]);
  });
});
