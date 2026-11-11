// Write, read, export, and delete a consumer's data.
import type pg from "pg";
import type { Vault } from "./vault.ts";
import { decrypt, encrypt } from "./crypto.ts";
import type { Event, Resident } from "./data.ts";

type Fields = Record<string, string>;
const PREFIX = "c1:"; // marks an encrypted value

// Without a vault (naive version), personal data is written in plain text.
export async function protect(
  vault: Vault | undefined,
  consumer: number,
  fields: Fields,
): Promise<Fields> {
  if (!vault) return fields;
  const key = (await vault.key(consumer)) ?? (await vault.create(consumer));
  const sealed: Fields = {};
  for (const [name, value] of Object.entries(fields))
    sealed[name] = PREFIX + encrypt(key, value);
  return sealed;
}

// Without the consumer's key, there is no way to read: it returns undefined.
export async function reveal(
  vault: Vault | undefined,
  consumer: number,
  fields: Fields,
): Promise<Fields | undefined> {
  const encrypted = Object.values(fields).some((v) => v.startsWith(PREFIX));
  if (!encrypted) return fields;
  const key = await vault?.key(consumer);
  if (!key) return undefined;
  const plain: Fields = {};
  for (const [name, value] of Object.entries(fields))
    plain[name] = value.startsWith(PREFIX)
      ? decrypt(key, value.slice(PREFIX.length))
      : value; // public field, written in plain text
  return plain;
}

export async function register(db: pg.Client, vault: Vault | undefined, r: Resident) {
  const p = await protect(vault, r.consumer, {
    name: r.name,
    ssn: r.ssn,
    email: r.email,
  });
  await db.query("INSERT INTO directory.residents VALUES ($1, $2, $3, $4, $5)", [
    r.consumer,
    r.unit,
    p.name,
    p.ssn,
    p.email,
  ]);
  await db.query(
    "INSERT INTO directory.charges (consumer, unit, period, amount_cents, paid) " +
      "VALUES ($1, $2, '2026-10', 89000, true)",
    [r.consumer, r.unit],
  );
}

export async function publish(db: pg.Client, vault: Vault | undefined, e: Event) {
  const data = { ...e.public, ...(await protect(vault, e.consumer, e.personal)) };
  await db.query(
    "INSERT INTO events.published (consumer, type, time, data) " +
      "VALUES ($1, $2, $3, $4)",
    [e.consumer, e.type, e.time, data],
  );
}

// Right to know: everything Morada stores about the consumer
export async function exportData(db: pg.Client, vault: Vault | undefined, c: number) {
  const all = async (sql: string) => (await db.query(sql, [c])).rows;
  const [r] = await all("SELECT * FROM directory.residents WHERE consumer = $1");
  const charges = await all(
    "SELECT unit, period, amount_cents, paid FROM directory.charges " +
      "WHERE consumer = $1 ORDER BY id",
  );
  const evs = await all(
    "SELECT type, time, data FROM events.published " +
      "WHERE consumer = $1 ORDER BY seq",
  );
  const directory = await reveal(vault, c, {
    name: r.name,
    ssn: r.ssn,
    email: r.email,
  });
  const events = [];
  for (const e of evs)
    events.push({
      type: e.type,
      time: e.time,
      data: await reveal(vault, c, e.data),
    });
  return { consumer: c, unit: r.unit, directory, charges, events };
}

// Naive version: it deletes only the directory row.
export async function deleteFromDirectory(db: pg.Client, consumer: number) {
  await db.query("DELETE FROM directory.residents WHERE consumer = $1", [consumer]);
}

// Crypto-shredding: the directory row leaves the database, and the key leaves the
// vault. The published events and the backups do not change, but no one can read
// them anymore. The charges stay, because they keep only the unit, the amount, and
// the consumer number.
export async function forget(db: pg.Client, vault: Vault, consumer: number) {
  await deleteFromDirectory(db, consumer);
  await vault.destroy(consumer);
}
