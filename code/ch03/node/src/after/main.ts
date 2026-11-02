// Usage: node main.ts <input.json> <output-folder> [--today YYYY-MM-DD]
// Wires the modules together; the order of the reports no longer matters.
import fs from "node:fs";
import path from "node:path";
import { calculateCharges, chargeReport } from "./charges/index.ts";
import { delinquencyReport } from "./delinquency/index.ts";
import { financialReport } from "./financialreport/index.ts";

const [input, output, option, date] = process.argv.slice(2);
const today = option === "--today" ? new Date(date + "T00:00:00Z") : new Date();
const data = JSON.parse(fs.readFileSync(input, "utf8"));
const name = data.community.name;
const charges = calculateCharges(
  data.community.monthlyExpensesCents,
  data.units,
  today,
);

const reports = {
  delinquency: delinquencyReport(name, today, charges),
  charges: chargeReport(name, today, charges),
  "financial-report": financialReport(
    name,
    today,
    charges,
    data.expenses,
    data.reserveFundOpeningBalanceCents,
  ),
};
fs.mkdirSync(output, { recursive: true });
for (const [type, text] of Object.entries(reports)) {
  fs.writeFileSync(path.join(output, `${type}.txt`), text);
}
console.log("reports generated in " + output);
