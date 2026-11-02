// Usage: node main.ts <input.json> <output-folder> [--today YYYY-MM-DD]
// The gateway is hard-coded: the GATEWAY variable changes nothing here.
import fs from "node:fs";
import path from "node:path";
import { issueCharges } from "./issuing.ts";

const [input, output, option, date] = process.argv.slice(2);
const today = option === "--today" ? new Date(date + "T00:00:00Z") : new Date();
const data = JSON.parse(fs.readFileSync(input, "utf8"));
const { charges, registrations } = issueCharges(data, today);
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "charges.txt"), charges);
fs.writeFileSync(path.join(output, "registrations.txt"), registrations);
console.log("charges issued in " + output);
