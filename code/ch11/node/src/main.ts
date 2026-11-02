// Usage: node main.ts in-memory|dual-write|outbox <output-folder>
// Billing confirms three payments; Bookings and Communications react to the event.
import fs from "node:fs";
import path from "node:path";
import { connectDb, saveWithOutbox, savePayment } from "./infra/db.ts";
import { connectBroker, consumeAll, QUEUES, publish } from "./infra/broker.ts";
import { eventFor, type Payment, type PaymentConfirmed } from "./events.ts";
import { Communications } from "./modules/communications.ts";
import { Bookings } from "./modules/bookings.ts";

const [version, outDir] = process.argv.slice(2);
const scenario = JSON.parse(fs.readFileSync("/data/input/scenario.json", "utf8"));
const payments: Payment[] = scenario.payments;
const bookings = new Bookings(scenario.bookings);
const communications = new Communications();
const execution: string[] = [];

// In-memory bus: the subscribers run right away, in the same process
function runInMemory() {
  const subscribers = [
    (e: PaymentConfirmed) => bookings.onPaymentConfirmed(e),
    (e: PaymentConfirmed) => communications.onPaymentConfirmed(e),
  ];
  for (const p of payments) {
    const e = eventFor(p);
    execution.push(`${p.payment} confirmed; ${e.event} delivered in memory`);
    for (const subscriber of subscribers) subscriber(e);
  }
}

async function runWithBroker(withOutbox: boolean) {
  const db = await connectDb();
  const { channel, close } = await connectBroker();
  for (const p of payments) {
    const e = eventFor(p);
    if (withOutbox) {
      await saveWithOutbox(db, p, e);
      execution.push(`${p.payment} saved with ${e.event} in the outbox`);
      continue;
    }
    // Dual write: save to the database, then publish, in two separate steps
    await savePayment(db, p);
    if (p.failure === "after-write") {
      execution.push(`${p.payment} saved; the process crashed before publishing`);
      continue;
    }
    await publish(channel, e);
    execution.push(`${p.payment} saved; ${e.event} published`);
  }
  if (withOutbox) {
    const crashBeforeMark = new Set(
      payments
        .filter((p) => p.failure === "relay-before-mark")
        .map((p) => `E-${p.payment}`),
    );
    await runRelay(db, channel, crashBeforeMark);
    await runRelay(db, channel, crashBeforeMark);
  }
  await consumeAll(channel, QUEUES[0], (e) => bookings.onPaymentConfirmed(e));
  await consumeAll(channel, QUEUES[1], (e) => communications.onPaymentConfirmed(e));
  await close();
  await db.end();
}

// The relay reads the outbox and publishes what is pending; it marks it published later
async function runRelay(
  db: Awaited<ReturnType<typeof connectDb>>,
  channel: Awaited<ReturnType<typeof connectBroker>>["channel"],
  crashBeforeMark: Set<string>,
) {
  const { rows } = await db.query(
    "SELECT id, event, payload FROM outbox WHERE NOT published ORDER BY id",
  );
  for (const row of rows) {
    await publish(channel, JSON.parse(row.payload));
    if (crashBeforeMark.delete(row.event)) {
      execution.push(`relay published ${row.event} and crashed before marking`);
      return;
    }
    await db.query("UPDATE outbox SET published = true WHERE id = $1", [row.id]);
    execution.push(`relay published ${row.event}`);
  }
}

if (version === "in-memory") runInMemory();
else await runWithBroker(version === "outbox");

fs.mkdirSync(outDir, { recursive: true });
const write = (name: string, lines: string[]) =>
  fs.writeFileSync(path.join(outDir, name), lines.join("\n") + "\n");
write("execution.txt", execution);
write("consumption.txt", [...bookings.log, ...communications.log]);
write("result.txt", [...bookings.lines(), ...communications.notices]);
console.log(`${version}: output in ${outDir}`);
