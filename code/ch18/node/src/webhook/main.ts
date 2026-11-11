// The "webhook" version: the same deliveries go through the naive and the robust
// receiver.
import fs from "node:fs";
import path from "node:path";
import { deliver, type Dispatch } from "./gateway.ts";
import { Ledger, NaiveReceiver, RobustReceiver } from "./receivers.ts";

const data = process.argv[2];
const scenario = JSON.parse(
  fs.readFileSync(path.join(data, "input", "webhook.json"), "utf8"),
);
const deliveries = (scenario.deliveries as Dispatch[]).map((dispatch) => ({
  dispatch,
  delivery: deliver(scenario.secret, scenario.now, dispatch),
}));

const dollars = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });

function run(title: string, receiver: NaiveReceiver | RobustReceiver) {
  const lines = [`== ${title}`];
  for (const { dispatch, delivery } of deliveries) {
    const r = receiver.receive(delivery);
    lines.push(`${dispatch.id}: ${r.status} ${r.reason}`);
  }
  const { charges, payments } = receiver.ledger;
  const statuses = [...charges.values()].map((c) => `${c.charge} ${c.status}`);
  const total = payments.reduce((sum, p) => sum + p.amountCents, 0);
  lines.push(
    `charges: ${statuses.join(" | ")}`,
    `payments recorded: ${payments.length}, $${dollars(total)}`,
    "",
  );
  return lines;
}

const result = [
  ...run("naive receiver", new NaiveReceiver(new Ledger(scenario.charges))),
  ...run(
    "robust receiver",
    new RobustReceiver(
      new Ledger(scenario.charges),
      scenario.secret,
      () => scenario.now,
    ),
  ),
];

const output = path.join(data, "output", "webhook");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), result.join("\n"));
console.log(`webhook: ${deliveries.length} deliveries for each receiver`);
