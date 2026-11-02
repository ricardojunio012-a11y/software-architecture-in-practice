// The Billing database: the payments and, in the outbox version, the table of events
// to publish, saved in the same transaction as the payment.
import pg from "pg";
import type { Payment, PaymentConfirmed } from "../events.ts";

export async function connectDb() {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query(`
    DROP TABLE IF EXISTS outbox, payments;
    CREATE TABLE payments (
      id text PRIMARY KEY, unit text, booking text, amount_cents integer);
    CREATE TABLE outbox (
      id serial PRIMARY KEY, event text UNIQUE, payload text,
      published boolean NOT NULL DEFAULT false)`);
  return db;
}

export async function savePayment(db: pg.Client, p: Payment) {
  await db.query("INSERT INTO payments VALUES ($1, $2, $3, $4)", [
    p.payment,
    p.unit,
    p.booking,
    p.amountCents,
  ]);
}

// Payment and event in the same transaction: either both are saved, or neither is
export async function saveWithOutbox(db: pg.Client, p: Payment, e: PaymentConfirmed) {
  await db.query("BEGIN");
  try {
    await savePayment(db, p);
    await db.query("INSERT INTO outbox (event, payload) VALUES ($1, $2)", [
      e.event,
      JSON.stringify(e),
    ]);
    await db.query("COMMIT");
  } catch (error) {
    // Without the ROLLBACK, the connection would be stuck in an aborted transaction
    await db.query("ROLLBACK");
    throw error;
  }
}
