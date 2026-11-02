// Usage: node main.ts <commands.json> <output-folder>
// Wires the modules and runs the Billing and Bookings commands in order.
import fs from "node:fs";
import path from "node:path";
import { Billing } from "./modules/billing/api.ts";
import { ChargesTable } from "./modules/billing/internal/table.ts";
import { Bookings } from "./modules/bookings/api.ts";
import { StandingFromTable } from "./modules/bookings/internal/standing.ts";

const [input, output] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(input, "utf8"));
const table = new ChargesTable();
const billing = new Billing(table);
// The shortcut: Bookings gets the Billing table, not its API
const bookings = new Bookings(data.spaces, new StandingFromTable(table));

interface Command {
  module: string;
  type: string;
  charge: string;
  unit: string;
  amountCents: number;
  dueDate: string;
  on: string;
  installments: number;
  booking: string;
  space: string;
  date: string;
}

function execute(c: Command): [string, string, string] {
  switch (c.type) {
    case "issue":
      return [
        c.charge,
        "issued",
        billing.issue(c.charge, c.unit, c.amountCents, c.dueDate),
      ];
    case "pay":
      return [c.charge, "paid", billing.pay(c.charge, c.on)];
    case "split":
      return [c.charge, "split", billing.split(c.charge, c.installments)];
    default:
      try {
        return [
          c.booking,
          "confirmed",
          bookings.book(c.booking, c.unit, c.space, c.date, c.on),
        ];
      } catch (error) {
        return [c.booking, "rejected", (error as Error).message];
      }
  }
}

const lines = data.commands.map((c: Command) => {
  const [id, status, detail] = execute(c);
  return `${id};${c.type};${status};${detail}`;
});
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "results.txt"), lines.join("\n") + "\n");
console.log(`${lines.length} commands executed; output in ${output}`);
