// Usage: node main.ts <input.json> <output-folder> [--today YYYY-MM-DD]
// Main does all the input and output; the bookings module does not touch files.
import fs from "node:fs";
import path from "node:path";
import { decide, notices, report } from "./bookings.ts";

const [input, output, option, date] = process.argv.slice(2);
const today = option === "--today" ? new Date(date + "T00:00:00Z") : new Date();
const decisions = decide(JSON.parse(fs.readFileSync(input, "utf8")), today);

// The real email client would go here; in the lab, a file
const emails = notices(decisions).map((n) => `to ${n.to}: ${n.text}`);
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(
  path.join(output, "bookings.txt"),
  report(decisions).join("\n") + "\n",
);
fs.writeFileSync(path.join(output, "emails.txt"), emails.join("\n") + "\n");
