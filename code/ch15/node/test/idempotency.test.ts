// Integration tests of idempotency against PostgreSQL: five simultaneous requests
// with the same key result in a single payment, and all of them get the same
// response; the same key at two management companies is two different requests.
import { describe, expect, it } from "vitest";
import { createApi, start } from "../src/api/api.ts";
import { prepareDatabase } from "../src/api/db.ts";

const pay = (url: string, company: string, charge: string, amount: number) =>
  fetch(`${url}/v1/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Morada-Management-Company": company,
      "Idempotency-Key": "k-1",
    },
    body: JSON.stringify({ charge, amountCents: amount }),
  });

describe.skipIf(!process.env.DATABASE_URL)("idempotency in PostgreSQL", () => {
  it("simultaneous requests with the same key pay only once", async () => {
    const db = await prepareDatabase(
      process.env.DATABASE_URL!,
      "/data/input/charges.json",
    );
    const api = createApi(db);
    const url = await start(api);
    const request = () => pay(url, "MC-A", "CH-04", 45000);
    const responses = await Promise.all([1, 2, 3, 4, 5].map(request));
    const bodies = await Promise.all(responses.map((r) => r.json()));
    expect(responses.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
    expect(new Set(bodies.map((b) => b.id)).size).toBe(1);
    const { rows } = await db.query("SELECT count(*)::int AS total FROM payments");
    expect(rows[0].total).toBe(1);
    api.close();
    await db.end();
  });

  it("the same key at two management companies does not collide", async () => {
    const db = await prepareDatabase(
      process.env.DATABASE_URL!,
      "/data/input/charges.json",
    );
    const api = createApi(db);
    const url = await start(api);
    const a = await pay(url, "MC-A", "CH-04", 45000);
    const b = await pay(url, "MC-B", "CH-05", 38000);
    expect([a.status, b.status]).toEqual([201, 201]);
    const [bodyA, bodyB] = [await a.json(), await b.json()];
    expect(bodyA.charge).toBe("CH-04");
    expect(bodyB.charge).toBe("CH-05");
    const { rows } = await db.query("SELECT count(*)::int AS total FROM payments");
    expect(rows[0].total).toBe(2);
    api.close();
    await db.end();
  });
});
