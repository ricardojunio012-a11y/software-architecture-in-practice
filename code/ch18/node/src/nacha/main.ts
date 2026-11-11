// The "nacha" version: Alpha Bank's return file goes through the anticorruption layer
// and reaches Billing as domain payments.
import fs from "node:fs";
import path from "node:path";
import { describe } from "../billing.ts";
import { translateReturn } from "./alpha-bank-return.ts";

const data = process.argv[2];
const text = fs.readFileSync(path.join(data, "input", "alpha-bank-return.txt"), "utf8");
const { payments, ignored } = translateReturn(text);

const result = [
  "payments received:",
  ...payments.map((p) => `  ${describe(p)}`),
  "entries that are not payments:",
  ...ignored.map((i) => `  ${i}`),
];

const output = path.join(data, "output", "nacha");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "payments.txt"), result.join("\n") + "\n");
console.log(`nacha: ${payments.length} payments, ${ignored.length} ignored`);
