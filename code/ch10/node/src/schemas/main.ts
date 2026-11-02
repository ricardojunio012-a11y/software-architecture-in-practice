// Usage: node main.ts <commands.json> <output-folder>   (needs DATABASE_URL)
// The hard part: the architecture test sees only imports, but the chapter's incident
// was an SQL query. Here each module has a schema and a role in PostgreSQL, and the
// database itself rejects the Bookings query on the Billing table.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

// Runs as the database owner: creates the schemas, the roles and the permissions
const SETUP = `
DROP SCHEMA IF EXISTS billing CASCADE;
DROP SCHEMA IF EXISTS bookings CASCADE;
DROP ROLE IF EXISTS billing_app;
DROP ROLE IF EXISTS bookings_app;
CREATE ROLE billing_app LOGIN PASSWORD 'billing';
CREATE ROLE bookings_app LOGIN PASSWORD 'bookings';
CREATE SCHEMA billing AUTHORIZATION billing_app;
CREATE SCHEMA bookings AUTHORIZATION bookings_app;
`;

// Runs as billing_app: the table is private; the public API is a function
const BILLING = `
CREATE TABLE billing.charges (
  charge text PRIMARY KEY, unit text NOT NULL, amount_cents int NOT NULL,
  due_date date NOT NULL, status text NOT NULL DEFAULT 'open');
CREATE FUNCTION billing.unit_in_good_standing(p_unit text, p_today date)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = billing AS $$
    SELECT NOT EXISTS (SELECT 1 FROM charges WHERE unit = p_unit
      AND status = 'open' AND due_date < p_today) $$;
REVOKE EXECUTE ON FUNCTION billing.unit_in_good_standing(text, date) FROM PUBLIC;
GRANT USAGE ON SCHEMA billing TO bookings_app;
GRANT EXECUTE ON FUNCTION billing.unit_in_good_standing(text, date) TO bookings_app;
`;

// The shortcut from the start of the chapter, written in SQL
const SHORTCUT = `SELECT count(*) AS n FROM billing.charges
  WHERE unit = $1 AND status <> 'paid' AND due_date < $2`;

const url = new URL(process.env.DATABASE_URL!);
function asRole(user: string, password: string) {
  const u = new URL(url);
  u.username = user;
  u.password = password;
  return new pg.Client({ connectionString: u.toString() });
}

async function attempt(db: pg.Client, sql: string, values: unknown[]) {
  try {
    const { rows } = await db.query(sql, values);
    return `accepted (${JSON.stringify(rows[0])})`;
  } catch (error) {
    const e = error as { code: string; message: string };
    return `rejected by the database [${e.code}] ${e.message}`;
  }
}

const [input, output] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(input, "utf8"));
const lines: string[] = [];

const owner = new pg.Client({ connectionString: url.toString() });
await owner.connect();
await owner.query(SETUP);

const billing = asRole("billing_app", "billing");
await billing.connect();
await billing.query(BILLING);
for (const c of data.commands.filter(
  (c: { module: string }) => c.module === "billing",
)) {
  if (c.type === "issue")
    await billing.query("INSERT INTO billing.charges VALUES ($1, $2, $3, $4)", [
      c.charge,
      c.unit,
      c.amountCents,
      c.dueDate,
    ]);
  else
    await billing.query("UPDATE billing.charges SET status = $2 WHERE charge = $1", [
      c.charge,
      c.type === "pay" ? "paid" : "split",
    ]);
}
lines.push("billing_app: table billing.charges loaded");

const bookings = asRole("bookings_app", "bookings");
await bookings.connect();
const params = ["B-101", "2026-03-02"];
lines.push(
  "bookings_app, shortcut into billing.charges: " +
    (await attempt(bookings, SHORTCUT, params)),
);
lines.push(
  "bookings_app, API billing.unit_in_good_standing(B-101): " +
    (await attempt(
      bookings,
      "SELECT billing.unit_in_good_standing($1, $2) AS in_good_standing",
      params,
    )),
);
lines.push(
  "bookings_app, create a table in the Billing schema: " +
    (await attempt(bookings, "CREATE TABLE billing.shortcut (x int)", [])),
);
// The common hole: the monolith connects with a single user that owns everything
lines.push(
  "the monolith's single user, same shortcut: " +
    (await attempt(owner, SHORTCUT, params)),
);

await Promise.all([owner.end(), billing.end(), bookings.end()]);
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "results.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
