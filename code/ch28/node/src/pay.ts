// Payment with an idempotency key: the key sent by the app is stored in the same
// transaction as the payment. A second request with the same key runs into the primary
// key, waits for the first one to finish and returns the same payment.
import type pg from "pg";

export async function pay(
  db: pg.Client,
  charge: string,
  amountCents: number,
  key: string | null,
): Promise<number> {
  await db.query("BEGIN");
  try {
    if (key) {
      // If another transaction already inserted this key, the INSERT waits for it
      const { rowCount } = await db.query(
        "INSERT INTO idempotency_keys (key) VALUES ($1) ON CONFLICT DO NOTHING",
        [key],
      );
      if (rowCount === 0) {
        const { rows } = await db.query(
          "SELECT payment_id FROM idempotency_keys WHERE key = $1",
          [key],
        );
        await db.query("COMMIT");
        return rows[0].payment_id; // the same response as the first request
      }
    }
    const { rows } = await db.query(
      "INSERT INTO payments (charge, amount_cents) VALUES ($1, $2) RETURNING id",
      [charge, amountCents],
    );
    if (key) {
      await db.query("UPDATE idempotency_keys SET payment_id = $1 WHERE key = $2", [
        rows[0].id,
        key,
      ]);
    }
    await db.query("COMMIT");
    return rows[0].id;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}
