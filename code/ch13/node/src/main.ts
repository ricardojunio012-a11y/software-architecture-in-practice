// Usage: node main.ts online|offline|restart|persisted <output-folder>
// Simulates a morning at the front desk with two tablets. In the offline version,
// tablet A loses the internet, works from the local queue, and syncs when it comes
// back. In the restart and persisted versions, the BFF restarts between the lost
// send and the resend.
import fs from "node:fs";
import path from "node:path";
import { Bookings, FrontDesk } from "./backend.ts";
import { StaffBff } from "./bff.ts";
import { Tablet } from "./tablet.ts";

const [version, output] = process.argv.slice(2);
const scenario = JSON.parse(fs.readFileSync("/data/input/scenario.json", "utf8"));
const frontDesk = new FrontDesk(scenario.packages);
const bookings = new Bookings(scenario.guests);
// In the persisted version, the result of each operation goes to a table that
// outlives the BFF process; in the others, it lives only in the BFF's memory
const operationsTable = new Map<string, string>();
const newBff = () =>
  new StaffBff(
    frontDesk,
    bookings,
    version === "persisted" ? operationsTable : new Map(),
  );
let bff = newBff();
const log: string[] = [];
const tablets: Record<string, Tablet> = {
  A: new Tablet("A", () => bff, log),
  B: new Tablet("B", () => bff, log),
};

for (const step of scenario.steps) {
  if (step.only && !step.only.includes(version)) continue;
  if (step.action === "restartBff") {
    bff = newBff();
    log.push("the BFF restarted: what was only in its memory is gone");
    continue;
  }
  const tablet = tablets[step.tablet];
  if (step.action === "open") tablet.open();
  else if (step.action === "disconnect") tablet.disconnect();
  else if (step.action === "reconnect") tablet.reconnect(step.loseResponse);
  else if (step.action === "resend") tablet.resend();
  else {
    const { tablet: _, action, ...data } = step;
    tablet.operate({ type: action, ...data });
  }
}

const state = [...frontDesk.packages.values()].map((p) =>
  p.by
    ? `${p.id} ${p.unit}: ${p.status} by tablet ${p.by} at ${p.time}`
    : `${p.id} ${p.unit}: ${p.status}`,
);
for (const v of frontDesk.visitors) {
  state.push(`${v.name} (${v.booking}) entered at ${v.time} on tablet ${v.tablet}`);
}
state.push(`repeated operations ignored: ${bff.repeated}`);

fs.mkdirSync(path.join(output, version), { recursive: true });
fs.writeFileSync(path.join(output, version, "log.txt"), log.join("\n") + "\n");
fs.writeFileSync(path.join(output, version, "state.txt"), state.join("\n") + "\n");
console.log(`${version}: output in ${output}/${version}`);
