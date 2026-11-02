// Usage: node main.ts <input.json> <output-folder> [--today YYYY-MM-DD]
// The only place that knows about files, the clock and concrete implementations.
import fs from "node:fs";
import path from "node:path";
import { generateBilling } from "./application.ts";
import { EmailToFile } from "./notification.ts";
import { Invoice } from "./payment.ts";

const [input, output, option, dateArg] = process.argv.slice(2);
const today = option === "--today" ? new Date(dateArg + "T00:00:00Z") : new Date();
const data = JSON.parse(fs.readFileSync(input, "utf8"));

fs.mkdirSync(output, { recursive: true });
const report = generateBilling(
  data,
  today,
  new Invoice(),
  new EmailToFile(path.join(output, "emails.txt")),
);
report.save(path.join(output, "charges.txt"));
console.log("charges generated in " + output);
