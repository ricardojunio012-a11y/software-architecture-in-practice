// The "api" version: sets up the database, starts the API, sends the requests in the
// script and checks each response against the contract openapi/v1.yaml.
import fs from "node:fs";
import path from "node:path";
import { createApi, start } from "./api/api.ts";
import { prepareDatabase } from "./api/db.ts";
import { readContract } from "./contract/openapi.ts";
import { validateResponse } from "./contract/validate.ts";

const data = process.argv[2];
const output = path.join(data, "output", "api");
const db = await prepareDatabase(
  process.env.DATABASE_URL!,
  path.join(data, "input", "charges.json"),
);
const contract = readContract(path.join(data, "openapi", "v1.yaml"));
const requests = JSON.parse(
  fs.readFileSync(path.join(data, "input", "requests.json"), "utf8"),
);
const api = createApi(db);
const url = await start(api);

const responses: string[] = [];
const discrepancies: string[] = [];
for (const [i, r] of requests.entries()) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // Who is calling (in place of the access token) and the idempotency key
  const extras: string[] = [];
  if (r.managementCompany) {
    headers["Morada-Management-Company"] = r.managementCompany;
    extras.push(`Morada-Management-Company: ${r.managementCompany}`);
  }
  if (r.key) {
    headers["Idempotency-Key"] = r.key;
    extras.push(`Idempotency-Key: ${r.key}`);
  }
  const response = await fetch(url + r.path, {
    method: r.method,
    headers,
    body: r.body ? JSON.stringify(r.body) : undefined,
  });
  const type = response.headers.get("content-type")!;
  const body = await response.json();
  const list = extras.length ? ` (${extras.join(", ")})` : "";
  responses.push(
    `${i + 1}. ${r.description}`,
    `   ${r.method} ${r.path}${list}`,
    ...(r.body ? [`   ${JSON.stringify(r.body)}`] : []),
    `   → ${response.status} ${type}`,
    `   ${JSON.stringify(body)}`,
    "",
  );
  const pathname = new URL(url + r.path).pathname;
  discrepancies.push(
    ...validateResponse(contract, r.method, pathname, response.status, type, body),
  );
}
api.close();

const { rows: payments } = await db.query(
  "SELECT id, charge, amount_cents FROM payments ORDER BY id",
);
const { rows: paid } = await db.query(
  "SELECT id FROM charges WHERE status = 'paid' ORDER BY id",
);
const { rows: keys } = await db.query(
  `SELECT management_company, string_agg(key, ', ' ORDER BY key) AS list
   FROM idempotency_keys GROUP BY management_company ORDER BY management_company`,
);
await db.end();
const state = [
  `payments recorded: ${payments.length}`,
  ...payments.map((p) => `  ${p.id}: charge ${p.charge}, ${p.amount_cents} cents`),
  `paid charges: ${paid.map((c) => c.id).join(", ")}`,
  "stored idempotency keys:",
  ...keys.map((k) => `  ${k.management_company}: ${k.list}`),
];
const check = [
  `${requests.length} responses checked against openapi/v1.yaml`,
  ...(discrepancies.length ? discrepancies : ["no discrepancies"]),
];

fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "responses.txt"), responses.join("\n"));
fs.writeFileSync(path.join(output, "state.txt"), state.join("\n") + "\n");
fs.writeFileSync(path.join(output, "contract.txt"), check.join("\n") + "\n");
console.log(`api: ${requests.length} requests, ${discrepancies.length} discrepancies`);
