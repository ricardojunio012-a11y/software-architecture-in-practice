// Two receivers of the same webhook. The naive one believes everything that arrives,
// in the order it arrives. The robust one checks the signature and the time window,
// ignores duplicates, and does not let an old event undo a newer one.
import { signatureMatches } from "./signature.ts";
import type { Charge, Delivery, GatewayEvent, Reply } from "./types.ts";

const WINDOW_SECONDS = 5 * 60;

export class Ledger {
  readonly charges = new Map<string, Charge>();
  readonly payments: { charge: string; amountCents: number }[] = [];

  constructor(initial: Charge[]) {
    for (const c of initial) this.charges.set(c.charge, { ...c });
  }

  apply(event: GatewayEvent) {
    const status = event.type === "charge.paid" ? "paid" : "refunded";
    this.charges.set(event.charge, {
      charge: event.charge,
      status,
      version: event.version,
    });
    if (status === "paid") {
      this.payments.push({ charge: event.charge, amountCents: event.amountCents });
    }
  }
}

export class NaiveReceiver {
  readonly ledger: Ledger;

  constructor(ledger: Ledger) {
    this.ledger = ledger;
  }

  receive(delivery: Delivery): Reply {
    const event: GatewayEvent = JSON.parse(delivery.body);
    this.ledger.apply(event);
    return { status: 200, reason: `applied: ${event.charge} ${event.type}` };
  }
}

export class RobustReceiver {
  readonly ledger: Ledger;
  readonly #secret: string;
  readonly #now: () => number;
  // In production, in a table, written in the same transaction as the effect (ch. 11)
  readonly #processed = new Set<string>();

  constructor(ledger: Ledger, secret: string, now: () => number) {
    this.ledger = ledger;
    this.#secret = secret;
    this.#now = now;
  }

  receive(delivery: Delivery): Reply {
    const id = delivery.headers["webhook-id"];
    const ts = Number(delivery.headers["webhook-timestamp"]);
    const signature = delivery.headers["webhook-signature"];
    // ① Who sent it: without the secret, no one produces this signature for this body
    if (!signatureMatches(this.#secret, id, ts, delivery.body, signature)) {
      return { status: 401, reason: "invalid signature" };
    }
    // ② When: a valid but old delivery may be an attacker's replay
    if (Math.abs(this.#now() - ts) > WINDOW_SECONDS) {
      return { status: 401, reason: "outside the 5-minute window" };
    }
    // ③ Duplicate: reply 200, so the sender stops resending, and do nothing
    if (this.#processed.has(id)) {
      return { status: 200, reason: "duplicate: ignored" };
    }
    // ④ Order: a version lower than or equal to the current one means a late event
    const event: GatewayEvent = JSON.parse(delivery.body);
    const current = this.ledger.charges.get(event.charge);
    let reply: Reply;
    if (current && event.version <= current.version) {
      const reason = `is not newer than ${current.version}`;
      reply = { status: 200, reason: `ignored: version ${event.version} ${reason}` };
    } else {
      this.ledger.apply(event);
      reply = { status: 200, reason: `applied: ${event.charge} ${event.type}` };
    }
    // Only after the effect: if apply fails, the delivery is not marked, the sender
    // resends, and it is tried again. In production, the mark and the effect go in the
    // same transaction (chapter 11).
    this.#processed.add(id);
    return reply;
  }
}
