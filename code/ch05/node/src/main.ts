// Usage: node main.ts <input.json> <output-folder> [--today YYYY-MM-DD]
// Assembles the objects and processes the booking requests in the order they arrived.
import fs from "node:fs";
import path from "node:path";
import {
  MinimumNotice,
  MonthlyLimit,
  SpaceAvailable,
  UnitInGoodStanding,
} from "./approval.ts";
import { EventBus } from "./events.ts";
import { ChannelFactory, SimulatedProvider } from "./notification.ts";
import { race } from "./race.ts";
import { InMemoryRepository } from "./repository.ts";
import { BookingService } from "./service.ts";
import { ChargeUsageFee, NotifyFrontDesk, NotifyResident } from "./subscribers.ts";
import type { Space, Unit } from "./types.ts";

const [input, output, option, date] = process.argv.slice(2);
const today = option === "--today" ? new Date(date + "T00:00:00Z") : new Date();
const data = JSON.parse(fs.readFileSync(input, "utf8"));
const spaces = new Map<string, Space>(data.spaces.map((s: Space) => [s.id, s]));
const units = new Map<string, Unit>(data.units.map((u: Unit) => [u.id, u]));

function buildApproval(bookings: InMemoryRepository) {
  const approval = new UnitInGoodStanding();
  approval
    .andThen(new MinimumNotice(today))
    .andThen(new SpaceAvailable(bookings))
    .andThen(new MonthlyLimit(bookings));
  return approval;
}
const bookings = new InMemoryRepository();
const approval = buildApproval(bookings);

const provider = new SimulatedProvider(
  data.simulatedFailures,
  data.invalidDestinations,
);
const outputs = {
  notifications: [] as string[],
  fees: [] as string[],
  frontDesk: [] as string[],
  waits: [] as string[],
};
// Simulated clock: records the wait instead of really waiting
const wait = (ms: number, who: string) => outputs.waits.push(`${who}: wait ${ms} ms`);
const factory = new ChannelFactory(provider, outputs.notifications, wait);
const events = new EventBus();
events.subscribe("BookingConfirmed", new ChargeUsageFee(outputs.fees));
events.subscribe("BookingConfirmed", new NotifyFrontDesk(outputs.frontDesk));
events.subscribe("BookingConfirmed", new NotifyResident(factory));
events.subscribe("BookingRejected", new NotifyResident(factory));

const service = new BookingService(approval, bookings, events);
const decisions: string[] = [];
for (const r of data.requests) {
  const request = { ...r, unit: units.get(r.unit)!, space: spaces.get(r.space)! };
  const d = service.submit(request);
  const result = d.approved ? "approved" : `rejected;${d.reason}`;
  decisions.push(`${r.id};${r.unit};${r.space};${r.date};${result}`);
}

// State: canceling depends on the state the booking is in
const cancellations: string[] = [];
for (const id of data.cancellations) {
  try {
    cancellations.push(`${id};${service.cancel(id)}`);
  } catch (error) {
    cancellations.push(`${id};error;${(error as Error).message}`);
  }
}

// Now the hard part: two requests at the same time for the same space and date
const simultaneous = data.simultaneousRequests.map((r: Record<string, string>) => ({
  ...r,
  unit: units.get(r.unit)!,
  space: spaces.get(r.space)!,
}));
const concurrency = race(simultaneous, () => {
  const fresh = new InMemoryRepository();
  return { chain: buildApproval(fresh), bookings: fresh };
});

const files: Record<string, string[]> = {
  bookings: decisions,
  notifications: outputs.notifications,
  sent: provider.delivered,
  fees: outputs.fees,
  "front-desk": outputs.frontDesk,
  failures: events.failures,
  waits: outputs.waits,
  cancellations,
  concurrency,
};
fs.mkdirSync(output, { recursive: true });
for (const [name, lines] of Object.entries(files)) {
  fs.writeFileSync(path.join(output, `${name}.txt`), lines.join("\n") + "\n");
}
console.log(`${decisions.length} requests processed; output in ${output}`);
