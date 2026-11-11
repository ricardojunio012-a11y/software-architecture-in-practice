// The robust receiver: applies the legitimate delivery once, rejects the tampered one,
// ignores the duplicate, and does not lose the delivery when the effect fails.
import { describe, expect, it } from "vitest";
import { deliver } from "../src/webhook/gateway.ts";
import { Ledger, RobustReceiver } from "../src/webhook/receivers.ts";

const SECRET = "whsec_" + Buffer.from("test-secret").toString("base64");
const NOW = 1793880000;
const dispatch = {
  id: "msg_t1",
  secondsAgo: 5,
  event: { type: "charge.paid", charge: "C-1", amountCents: 100, version: 2 },
} as const;

function receiver() {
  const ledger = new Ledger([{ charge: "C-1", status: "open", version: 1 }]);
  return new RobustReceiver(ledger, SECRET, () => NOW);
}

describe("robust receiver", () => {
  it("applies the legitimate delivery only once", () => {
    const r = receiver();
    const delivery = deliver(SECRET, NOW, dispatch);
    expect(r.receive(delivery).status).toBe(200);
    expect(r.receive(delivery).reason).toBe("duplicate: ignored");
    expect(r.ledger.payments).toHaveLength(1);
  });

  it("rejects a body changed after signing", () => {
    const delivery = deliver(SECRET, NOW, dispatch);
    const tampered = { ...delivery, body: delivery.body.replace("100", "1") };
    expect(receiver().receive(tampered).status).toBe(401);
  });

  it("does not lose the delivery when apply fails", () => {
    const r = receiver();
    const apply = r.ledger.apply.bind(r.ledger);
    let failures = 1;
    r.ledger.apply = (event) => {
      if (failures-- > 0) throw new Error("database down");
      apply(event);
    };
    const delivery = deliver(SECRET, NOW, dispatch);
    expect(() => r.receive(delivery)).toThrow("database down");
    expect(r.receive(delivery).reason).toBe("applied: C-1 charge.paid");
    expect(r.ledger.payments).toHaveLength(1);
  });
});
