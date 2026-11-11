// The "payment" version: the resident taps the "pay" button twice, and the two requests
// arrive together, each over its own connection. First without an idempotency key, then
// with the same key on both.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { pay } from "./pay.ts";

const data = process.argv[2];
const connect = async () => {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  return c;
};
const admin = await connect();
await admin.query(fs.readFileSync(path.join(data, "sql", "schema.sql"), "utf8"));
const [a, b] = await Promise.all([connect(), connect()]);

const lines: string[] = [];
for (const [name, charge, key] of [
  ["without an idempotency key", "C-301", null],
  ["with the same key on both taps", "C-302", "tap-7f3a"],
] as const) {
  const ids = await Promise.all([
    pay(a, charge, 45000, key),
    pay(b, charge, 45000, key),
  ]);
  const { rows } = await admin.query(
    "SELECT count(*)::integer AS n FROM payments WHERE charge = $1",
    [charge],
  );
  const responses = ids[0] === ids[1] ? "the same payment" : "different payments";
  lines.push(
    `${name}\n  ${rows[0].n} payment(s) for ${charge}; ` +
      `the two responses carry ${responses}`,
  );
}

await Promise.all([admin.end(), a.end(), b.end()]);
const output = path.join(data, "output", "payment");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
