// Usage: node contacts.ts <output-folder>
// The hard part of the extraction. To send a notice, Communications needs the
// resident's email, which belongs to the Directory and, in the monolith, came from
// a join with its table. Outside the monolith, with no shared table, there are two
// paths: query the Directory through its API on every notice, or keep a replica of
// the contacts, fed by the ContactChanged events. A simulated clock, in minutes,
// keeps the output the same on any machine: one notice per minute, and the
// Directory down for 10 minutes.
import fs from "node:fs";
import path from "node:path";

interface Change {
  minute: number;
  unit: string;
  email: string;
}
const scenario = JSON.parse(fs.readFileSync("/data/input/contacts.json", "utf8"));
const changes: Change[] = scenario.changes;
const { from, to } = scenario.directoryDown;
const lag: number = scenario.replicaLag;
const [outDir] = process.argv.slice(2);

const two = (n: number) => String(n).padStart(2, "0");
const unitOf = (notice: number) => `U-${two(((notice - 1) % scenario.units) + 1)}`;
const idOf = (notice: number) => `E-P-${String(notice).padStart(3, "0")}`;
const directoryUp = (minute: number) => minute < from || minute > to;

// A unit's email at a given minute, counting the changes already in effect
function emailAt(unit: string, minute: number, copyLag = 0) {
  let email = `resident.${unit.toLowerCase().replace("-", "")}@example.com`;
  for (const c of changes) {
    if (c.unit === unit && c.minute + copyLag <= minute) email = c.email;
  }
  return email;
}

// Path 1: on every notice, ask the Directory for the email. If it does not answer,
// the notice waits in a local queue and goes out when the Directory comes back.
function byLookup() {
  let calls = 0;
  let errors = 0;
  let rightAway = 0;
  let longestDelay = 0;
  const held: number[] = [];
  for (let notice = 1; notice <= scenario.notices; notice++) {
    const minute = notice;
    if (directoryUp(minute)) {
      for (const queued of held.splice(0)) {
        calls += 1;
        longestDelay = Math.max(longestDelay, minute - queued);
      }
    }
    calls += 1;
    if (!directoryUp(minute)) {
      errors += 1;
      held.push(minute);
      continue;
    }
    rightAway += 1;
  }
  return [
    "Querying the Directory API on every notice",
    `  calls to the Directory: ${calls} (${errors} failed)`,
    `  notices sent right away: ${rightAway}`,
    `  notices held until the Directory came back: ${errors} ` +
      `(longest delay: ${longestDelay} min)`,
    // Each lookup reads the current email: no notice goes to an old address
    "  notices sent to an outdated email: 0",
  ];
}

// Path 2: Communications keeps a copy of the contacts, loaded once and updated by
// the events, which arrive a few minutes after the change
function byReplica() {
  const outdated: string[] = [];
  for (let notice = 1; notice <= scenario.notices; notice++) {
    const unit = unitOf(notice);
    const used = emailAt(unit, notice, lag);
    if (used === emailAt(unit, notice)) continue;
    const c = changes.filter((x) => x.unit === unit && x.minute <= notice).pop()!;
    outdated.push(
      `    ${idOf(notice)} to ${unit}: old email ` +
        `(changed at minute ${c.minute}; in the replica, at ${c.minute + lag})`,
    );
  }
  const applied = changes.filter((c) => c.minute + lag <= scenario.notices);
  return [
    `Contacts replica fed by events (lag of ${lag} min)`,
    `  initial load: ${scenario.units} contacts`,
    `  ContactChanged events applied: ${applied.length}`,
    "  calls to the Directory: 0",
    `  notices sent right away: ${scenario.notices}`,
    "  notices held until the Directory came back: 0",
    `  notices sent to an outdated email: ${outdated.length}`,
    ...outdated,
  ];
}

fs.mkdirSync(path.join(outDir, "contacts"), { recursive: true });
const lines = [...byLookup(), "", ...byReplica()];
fs.writeFileSync(path.join(outDir, "contacts", "result.txt"), lines.join("\n") + "\n");
console.log(`contacts: output in ${outDir}/contacts`);
