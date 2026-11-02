// Usage: node main.ts <input.json> <output-folder> [--today YYYY-MM-DD]
import fs from "node:fs";
import path from "node:path";
import { config } from "./config/config.ts";
import { calculateAll, generateOutput } from "./services/services.ts";

const [input, output, option, date] = process.argv.slice(2);
config.today = option === "--today" ? new Date(date + "T00:00:00Z") : new Date();
config.data = JSON.parse(fs.readFileSync(input, "utf8"));
calculateAll();

// The order matters: the delinquency report reorders the list of charges
fs.mkdirSync(output, { recursive: true });
for (const type of ["charges", "delinquency", "financial-report"]) {
  fs.writeFileSync(path.join(output, `${type}.txt`), generateOutput(type));
}
console.log("reports generated in " + output);
