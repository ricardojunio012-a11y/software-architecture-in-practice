// The migration of one customer from the legacy to Morada, and the reconciliation
// that says whether it worked. The reconciliation does not use the migration code:
// it counts and sums on both sides, in SQL, and requires legacy = Morada +
// quarantine on every row.
import type { PGlite } from "@electric-sql/pglite";
import type { DatabaseSync } from "node:sqlite";
import { readLegacy, translate, type Rules, type Translation } from "./acl/beta.ts";

// Writes the translation with "insert or update": running it twice gives the same
// result
export async function save(db: PGlite, t: Translation): Promise<void> {
  const up = (table: string, cols: string[], conflict: string) => {
    const ph = cols.map((_, i) => `$${i + 1}`).join(", ");
    const set = cols.map((c) => `${c} = EXCLUDED.${c}`).join(", ");
    return `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${ph})
            ON CONFLICT (${conflict}) DO UPDATE SET ${set}`;
  };
  await db.transaction(async (tx) => {
    const { id, name, ein } = t.community;
    await tx.query(up("communities", ["id", "name", "ein"], "id"), [id, name, ein]);
    const colsU = ["id", "community_id", "building", "number", "share", "exempt"];
    for (const u of t.units)
      await tx.query(up("units", colsU, "id"), [
        u.id,
        id,
        u.building,
        u.number,
        u.share,
        u.exempt,
      ]);
    for (const s of t.spaces)
      await tx.query(up("parking_spaces", ["id", "unit_id", "share"], "id"), [
        s.id,
        s.unit_id,
        s.share,
      ]);
    const colsB = ["community_id", "period", "amount_cents"];
    for (const b of t.budgets)
      await tx.query(up("budgets", colsB, "community_id, period"), [
        id,
        b.period,
        b.amount_cents,
      ]);
    const colsC = ["id", "unit_id", "item", "period", "due_date"];
    colsC.push("amount_cents", "paid_on");
    for (const c of t.charges)
      await tx.query(up("charges", colsC, "id"), [
        c.id,
        c.unit_id,
        c.item,
        c.period,
        c.due_date,
        c.amount_cents,
        c.paid_on,
      ]);
    const colsK = ["legacy_key", "unit_id", "item"];
    for (const k of t.keyMap)
      await tx.query(up("acl.key_map", colsK, "legacy_key"), [
        k.legacy_key,
        k.unit_id,
        k.item,
      ]);
    // The quarantine is rebuilt on every run: whatever was resolved leaves it
    await tx.query("DELETE FROM acl.quarantine WHERE legacy_key LIKE ANY ($1)", [
      [...new Set(t.keyMap.map((k) => k.legacy_key.split("/")[0] + "/%"))],
    ]);
    for (const q of t.quarantine)
      await tx.query(up("acl.quarantine", ["legacy_key", "reason"], "legacy_key"), [
        q.legacy_key,
        q.reason,
      ]);
  });
}

export async function migrate(
  legacy: DatabaseSync,
  morada: PGlite,
  ein: string,
  until: string,
  rules: Rules,
): Promise<Translation> {
  const t = translate(readLegacy(legacy, ein, until), rules);
  await save(morada, t);
  return t;
}

// The naive copy: reads the same data and converts it "the obvious way", without
// the layer
export async function migrateNaive(
  legacy: DatabaseSync,
  morada: PGlite,
  ein: string,
  until: string,
): Promise<void> {
  const l = readLegacy(legacy, ein, until);
  const id = "c" + ein.replace(/\D/g, "").slice(0, 8);
  await morada.query("INSERT INTO communities VALUES ($1, $2, $3)", [id, "?", ein]);
  for (const a of l.apts)
    await morada.query("INSERT INTO units VALUES ($1, $2, $3, $4, $5, false)", [
      `${a.property}/${a.apt}`,
      id,
      a.property,
      a.apt,
      parseFloat(a.share),
    ]);
  for (const a of l.assessments) {
    const due = new Date(a.due); // "10/11/2026": JavaScript reads month/day/year
    const paid = a.paid === "Y" ? new Date(a.pay_date).toISOString() : null;
    await morada.query("INSERT INTO charges VALUES ($1, $2, 'dues', $3, $4, $5, $6)", [
      `${a.property}/${a.apt}.${a.period}`,
      `${a.property}/${a.apt}`,
      a.period.split("/").reverse().join("-"),
      due.toISOString().slice(0, 10),
      Math.round(parseFloat(a.amount) * 100), // "1,048.72": stops at the comma
      paid?.slice(0, 10),
    ]);
  }
}

export type Row = {
  item: string;
  legacy: number;
  morada: number;
  quarantine: number;
};

// The reconciliation: each number is computed independently in the two databases
export async function reconcile(
  legacy: DatabaseSync,
  morada: PGlite,
  ein: string,
  until: string,
): Promise<Row[]> {
  const id = "c" + ein.replace(/\D/g, "").slice(0, 8);
  const periods = `substr(period, 4) || '-' || substr(period, 1, 2) <= '${until}'`;
  const cents = "CAST(replace(replace(amount, ',', ''), '.', '') AS INTEGER)";
  const fromLegacy = (sql: string) =>
    Number(Object.values(legacy.prepare(sql).get(ein) as object)[0] ?? 0);
  const properties = "property IN (SELECT code FROM property WHERE ein = ?)";
  const fromMorada = async (sql: string) => {
    const { rows } = await morada.query<{ n: string }>(sql, [id]);
    return Number(rows[0].n ?? 0);
  };
  const ofUnits =
    "unit_id IN (SELECT id FROM units WHERE community_id = $1)" +
    ` AND period <= '${until}'`;
  const inQuarantine = `(property || '/' || apt) IN (${await quarantineList(morada)})`;

  const rows: Row[] = [];
  const row = async (item: string, l: string, m: string, q: string) =>
    rows.push({
      item,
      legacy: fromLegacy(l),
      morada: await fromMorada(m),
      quarantine: q ? fromLegacy(q) : 0,
    });
  await row(
    "units (apts of type A)",
    `SELECT count(*) FROM apt WHERE type = 'A' AND ${properties}`,
    "SELECT count(*) n FROM units WHERE community_id = $1",
    "",
  );
  await row(
    "parking spaces (apts of type G)",
    `SELECT count(*) FROM apt WHERE type = 'G' AND ${properties}`,
    `SELECT count(*) n FROM parking_spaces
       WHERE unit_id IN (SELECT id FROM units WHERE community_id = $1)`,
    `SELECT count(*) FROM apt WHERE type = 'G' AND ${properties} AND ${inQuarantine}`,
  );
  const where = `WHERE ${properties} AND ${periods}`;
  await row(
    "charges",
    `SELECT count(*) FROM assessment ${where}`,
    `SELECT count(*) n FROM charges WHERE ${ofUnits}`,
    `SELECT count(*) FROM assessment ${where} AND ${inQuarantine}`,
  );
  await row(
    "sum of the charges (cents)",
    `SELECT sum(${cents}) FROM assessment ${where}`,
    `SELECT sum(amount_cents) n FROM charges WHERE ${ofUnits}`,
    `SELECT sum(${cents}) FROM assessment ${where} AND ${inQuarantine}`,
  );
  await row(
    "sum of the paid ones (cents)",
    `SELECT sum(${cents}) FROM assessment ${where} AND paid = 'Y'`,
    `SELECT sum(amount_cents) n FROM charges WHERE ${ofUnits} AND paid_on IS NOT NULL`,
    `SELECT sum(${cents}) FROM assessment ${where} AND paid = 'Y' AND ${inQuarantine}`,
  );
  await row(
    "due dates outside the charge's month",
    `SELECT count(*) FROM assessment ${where} AND substr(due, 4) <> period`,
    `SELECT count(*) n FROM charges WHERE ${ofUnits}
       AND to_char(due_date, 'YYYY-MM') <> period`,
    "",
  );
  return rows;
}

async function quarantineList(morada: PGlite): Promise<string> {
  const { rows } = await morada.query<{ k: string }>(
    "SELECT legacy_key k FROM acl.quarantine",
  );
  return rows.map((r) => `'${r.k}'`).join(",") || "''";
}
