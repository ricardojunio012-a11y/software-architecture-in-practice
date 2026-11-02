// Usage: node main.ts <input.json> <output-folder> [--today YYYY-MM-DD]
import { generateBilling } from "./billing.ts";

const [input, output, option, dateArg] = process.argv.slice(2);
const today = option === "--today" ? new Date(dateArg + "T00:00:00Z") : new Date();
generateBilling(input, output, today);
console.log("charges generated in " + output);
