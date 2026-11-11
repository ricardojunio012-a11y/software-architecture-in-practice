// Morada's database: an embedded PostgreSQL (PGlite), in memory. The schema is
// Morada's, which knows nothing about Beta. The only exception is the "acl" schema,
// which belongs to the anticorruption layer and keeps the map between the keys of
// the two worlds.
import { PGlite } from "@electric-sql/pglite";

export const SCHEMA = `
  CREATE TABLE communities (id text PRIMARY KEY, name text, ein text UNIQUE);
  CREATE TABLE units (id text PRIMARY KEY, community_id text, building text,
                      number text, share numeric(9,6), exempt boolean);
  CREATE TABLE parking_spaces (id text PRIMARY KEY, unit_id text,
                               share numeric(9,6));
  CREATE TABLE budgets (community_id text, period text, amount_cents int,
                        PRIMARY KEY (community_id, period));
  CREATE TABLE charges (id text PRIMARY KEY, unit_id text, item text,
                        period text, due_date date, amount_cents int,
                        paid_on date);
  CREATE TABLE notices (id serial PRIMARY KEY, community_id text, title text);
  CREATE SCHEMA acl;
  CREATE TABLE acl.key_map (legacy_key text PRIMARY KEY, unit_id text, item text);
  CREATE TABLE acl.quarantine (legacy_key text PRIMARY KEY, reason text);
`;

export async function createMorada(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SCHEMA);
  return db;
}

// Morada's calculation: splits the budget by the shares, in cents, and hands out
// the cents left over to the largest remainders, so that the rounded sum does not
// lose cents. The legacy truncates each part and loses up to one cent per apt.
export async function computeCharges(
  db: PGlite,
  community: string,
  period: string,
): Promise<void> {
  const budget = await db.query<{ amount_cents: number }>(
    "SELECT amount_cents FROM budgets WHERE community_id = $1 AND period = $2",
    [community, period],
  );
  const { rows: parts } = await db.query<{
    unit_id: string;
    item: string;
    share: string;
    exempt: boolean;
  }>(
    `SELECT u.id unit_id, 'dues' item, u.share, u.exempt FROM units u
       WHERE u.community_id = $1
     UNION ALL
     SELECT u.id, s.id, s.share, false FROM parking_spaces s
       JOIN units u ON u.id = s.unit_id WHERE u.community_id = $1
     ORDER BY 1, 2`,
    [community],
  );
  const total = budget.rows[0].amount_cents;
  const exact = parts.map((p) => (p.exempt ? 0 : total * Number(p.share)));
  const amounts = exact.map(Math.floor);
  let left = Math.round(exact.reduce((s, v) => s + v, 0)) - sum(amounts);
  const byRemainder = exact
    .map((v, i) => ({ i, remainder: v - Math.floor(v) }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const { i } of byRemainder) if (left-- > 0) amounts[i] += 1;

  const [year, month] = period.split("-");
  for (const [i, p] of parts.entries())
    await db.query(
      `INSERT INTO charges VALUES ($1, $2, $3, $4, $5, $6, NULL)
       ON CONFLICT (id) DO UPDATE SET amount_cents = EXCLUDED.amount_cents`,
      [
        `${p.item === "dues" ? p.unit_id : p.item}.${period}`,
        p.unit_id,
        p.item,
        period,
        `${year}-${month}-10`,
        amounts[i],
      ],
    );
}

const sum = (v: number[]) => v.reduce((s, x) => s + x, 0);
