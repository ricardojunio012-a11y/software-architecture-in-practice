// The API's database: communities, charges, payments and idempotency keys. The
// primary key of the keys table, (management_company, key), guarantees a single
// processing per key of each client, even with simultaneous requests.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));

export async function prepareDatabase(url: string, chargesFile: string) {
  const db = new pg.Pool({ connectionString: url });
  await db.query(`
    DROP TABLE IF EXISTS idempotency_keys, payments, charges, communities;
    DROP SEQUENCE IF EXISTS payments_seq;
    CREATE TABLE communities (id text PRIMARY KEY, management_company text NOT NULL);
    CREATE TABLE charges (
      id text PRIMARY KEY,
      community text NOT NULL REFERENCES communities,
      unit text NOT NULL,
      due_date date NOT NULL,
      amount_cents integer NOT NULL,
      status text NOT NULL
    );
    CREATE TABLE payments (
      id text PRIMARY KEY,
      charge text NOT NULL UNIQUE REFERENCES charges,
      amount_cents integer NOT NULL
    );
    CREATE SEQUENCE payments_seq;
    CREATE TABLE idempotency_keys (
      management_company text,
      key text,
      request text NOT NULL,
      status integer,
      response text,
      PRIMARY KEY (management_company, key)
    )`);
  // Who manages each community is in communities.json, next to the charges
  const folder = path.dirname(chargesFile);
  for (const c of readJson(path.join(folder, "communities.json"))) {
    await db.query("INSERT INTO communities VALUES ($1, $2)", [
      c.id,
      c.managementCompany,
    ]);
  }
  for (const c of readJson(chargesFile)) {
    await db.query("INSERT INTO charges VALUES ($1, $2, $3, $4, $5, $6)", [
      c.id,
      c.community,
      c.unit,
      c.dueDate,
      c.amountCents,
      c.status,
    ]);
  }
  return db;
}
