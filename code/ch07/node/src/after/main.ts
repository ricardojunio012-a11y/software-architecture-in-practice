// Usage: node main.ts <commands.json> <output-folder>
// Assembles the repository and the application service and runs the commands in order.
import fs from "node:fs";
import path from "node:path";
import { InMemorySchedules } from "./application/repository.ts";
import { BookingService, type Command } from "./application/booking-service.ts";
import type { UsagePolicy } from "./domain/schedule.ts";
import { Money } from "./domain/money.ts";
import type { DomainEvent } from "./domain/events.ts";

const [input, output] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(input, "utf8"));
const policies = new Map<string, UsagePolicy>(
  data.spaces.map((s: any) => [
    s.id,
    {
      fee: Money.fromCents(s.feeCents),
      minNoticeDays: s.minNoticeDays,
      monthlyLimit: s.monthlyLimit,
    },
  ]),
);

const events: string[] = [];
const cancellation = (fee: Money) =>
  fee.cents ? `cancellation fee ${fee}` : "no cancellation fee";
const publish = (e: DomainEvent) =>
  events.push(
    e.type === "BookingConfirmed"
      ? `${e.type};${e.booking};${e.space};${e.slot};${e.unit};${e.fee}`
      : `${e.type};${e.booking};${cancellation(e.cancellationFee)}`,
  );
const schedules = new InMemorySchedules(policies);
const service = new BookingService(schedules, publish);

const results = (data.commands as Command[]).map((c) => {
  const r = service.execute(c);
  return `${r.booking};${r.command};${r.status};${r.detail}`;
});
const schedule = schedules
  .all()
  .flatMap((s) => s.active().map((b) => `${s.space};${b.id};${b.slot};${b.unit}`));

fs.mkdirSync(output, { recursive: true });
for (const [name, lines] of Object.entries({ results, events, schedule })) {
  fs.writeFileSync(path.join(output, `${name}.txt`), lines.join("\n") + "\n");
}
console.log(`${results.length} commands executed; output in ${output}`);
