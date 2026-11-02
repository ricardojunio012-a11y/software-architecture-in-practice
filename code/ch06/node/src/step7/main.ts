// Step 7: the strangler fig. A facade receives every request and decides, space by
// space, who answers: the old code (step 6) or the new one (new.ts).
// Usage: node main.ts <input.json> <output-folder> [--today YYYY-MM-DD]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { notices, report, type Request } from "../step5/bookings.ts";
import { processBookings } from "../step6/main.ts";
import { decide } from "./new.ts";

// The route of each space. "experiment": the old code answers and the new one runs
// alongside, only to compare. With each validated slice, one space changes route; in
// the end, the old code leaves.
type Route = "old" | "experiment" | "new";
const ROUTES: Record<string, Route> = {
  "party-room": "new",
  "grill-area": "experiment",
};
const routeOf = (r: Request): Route => ROUTES[r.space] ?? "old";

type Answer = { line: string; email: string };

// The old code was not made to be called like this: it takes a file and writes another.
// The facade adapts to it, through the step 2 seams, without changing a line of it.
function oldCode(data: any, today: Date): Map<string, Answer> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "old-"));
  fs.writeFileSync(path.join(dir, "requests.json"), JSON.stringify(data));
  const emails: string[] = [];
  const mailer = {
    send: (to: string, t: string) => emails.push(`to ${to}: ${t}`),
  };
  processBookings(path.join(dir, "requests.json"), dir, today, mailer);
  const lines = fs.readFileSync(path.join(dir, "bookings.txt"), "utf8").split("\n");
  return new Map(
    data.requests.map((r: Request, i: number) => [
      r.id,
      { line: lines[i], email: emails[i] },
    ]),
  );
}

function newCode(data: any, today: Date): Map<string, Answer> {
  const decisions = decide(data, today);
  const lines = report(decisions);
  const emails = notices(decisions).map((n) => `to ${n.to}: ${n.text}`);
  return new Map(
    decisions.map((d, i) => [d.request.id, { line: lines[i], email: emails[i] }]),
  );
}

const [input, output, option, date] = process.argv.slice(2);
const today = option === "--today" ? new Date(date + "T00:00:00Z") : new Date();
const data = JSON.parse(fs.readFileSync(input, "utf8"));
const only = (routes: Route[]) => ({
  ...data,
  requests: data.requests.filter((r: Request) => routes.includes(routeOf(r))),
});
const fromOld = oldCode(only(["old", "experiment"]), today);
const fromNew = newCode(only(["new", "experiment"]), today);

// The experiment compares the two answers, but the old code is what answers residents
const compared = data.requests.filter((r: Request) => routeOf(r) === "experiment");
const mismatched = compared.filter(
  (r: Request) =>
    JSON.stringify(fromOld.get(r.id)) !== JSON.stringify(fromNew.get(r.id)),
);
const [total, n] = [compared.length, mismatched.length];
console.log(`experiment: ${total} requests compared, ${n} with differences`);
for (const r of mismatched) {
  const [o, nw] = [fromOld.get(r.id)!.line, fromNew.get(r.id)!.line];
  console.log(`  ${r.id}: old ${o} | new ${nw}`);
}

const answers = data.requests.map((r: Request) =>
  (routeOf(r) === "new" ? fromNew : fromOld).get(r.id)!,
);
fs.mkdirSync(output, { recursive: true });
const write = (name: string, lines: string[]) =>
  fs.writeFileSync(path.join(output, name), lines.join("\n") + "\n");
write(
  "bookings.txt",
  answers.map((a: Answer) => a.line),
);
write(
  "emails.txt",
  answers.map((a: Answer) => a.email),
);
