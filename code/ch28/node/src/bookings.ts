// The "bookings" version: 20 residents ask for the grill area at the same instant, for
// Saturday from 12:00 to 16:00 (half of them for 13:00 to 17:00, which overlaps). Each
// request uses its own connection, like requests that reach different replicas.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import {
  type BookingRequest,
  bookNaive,
  bookOptimistic,
  bookWithConstraint,
} from "./book.ts";

const data = process.argv[2];
const connect = async () => {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  return c;
};
const admin = await connect();
await admin.query(fs.readFileSync(path.join(data, "sql", "schema.sql"), "utf8"));

const requests: BookingRequest[] = Array.from({ length: 20 }, (_, i) => ({
  resident: `resident ${i + 1}`,
  start: i % 2 === 0 ? "2026-11-07 12:00" : "2026-11-07 13:00",
  end: i % 2 === 0 ? "2026-11-07 16:00" : "2026-11-07 17:00",
}));
const connections = await Promise.all(requests.map(() => connect()));

const ways: [string, string, typeof bookNaive][] = [
  ["check-then-insert", "naive_bookings", bookNaive],
  ["optimistic locking", "optimistic_bookings", bookOptimistic],
  ["exclusion constraint", "bookings", bookWithConstraint],
];
const lines = ["20 simultaneous requests for the grill area on Saturday afternoon"];
for (const [name, table, book] of ways) {
  const accepted = await Promise.all(requests.map((r, i) => book(connections[i], r)));
  const { rows } = await admin.query(`SELECT count(*)::integer AS n FROM ${table}`);
  const n = rows[0].n;
  const howMany = n === 1 ? "1 booking" : "more than one booking for the same slot";
  lines.push(
    `  ${name.padEnd(22)} ${howMany}` +
      (n === 1 ? `; ${accepted.filter((a) => !a).length} requests rejected` : ""),
  );
}

await Promise.all([admin.end(), ...connections.map((c) => c.end())]);
const output = path.join(data, "output", "bookings");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
