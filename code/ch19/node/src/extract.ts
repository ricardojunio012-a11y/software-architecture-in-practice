// Extraction (the E of ELT): reads the tables of the transactional database and writes
// each one as a CSV file in the raw zone. Personal data is handled on the way: the
// resident's name never leaves the source, and tax ID and plate leave pseudonymized.
import fs from "node:fs";
import path from "node:path";
import type pg from "pg";
import { pseudonym } from "./pseudonym.ts";

type Row = Record<string, string | number>;

const QUERIES: Record<string, string> = {
  communities: "SELECT id, state, units FROM communities",
  residents: "SELECT id, community_id, tax_id FROM residents",
  vehicles: "SELECT plate, resident_id FROM vehicles",
  charges:
    "SELECT id, community_id, resident_id, to_char(due_date, 'YYYY-MM-DD') " +
    "AS due_date, amount_cents, status FROM charges",
};

// Personal column -> column that goes to the raw zone
const PERSONAL: Record<string, string> = {
  tax_id: "tax_id_pseudonym",
  plate: "plate_pseudonym",
};

function toCsv(rows: Row[]): string {
  const columns = Object.keys(rows[0]);
  const body = rows.map((r) => columns.map((c) => String(r[c])).join(","));
  return [columns.join(","), ...body].join("\n") + "\n";
}

export async function extract(
  db: pg.Client,
  key: string,
  rawZone: string,
): Promise<Record<string, number>> {
  fs.mkdirSync(rawZone, { recursive: true });
  const counts: Record<string, number> = {};
  for (const [table, query] of Object.entries(QUERIES)) {
    const { rows } = await db.query(query + " ORDER BY 1");
    const extracted = rows.map((row: Row) => {
      const out: Row = {};
      for (const [column, value] of Object.entries(row)) {
        const personal = PERSONAL[column];
        if (personal) out[personal] = pseudonym(key, String(value).trim());
        else out[column] = value;
      }
      return out;
    });
    fs.writeFileSync(path.join(rawZone, `${table}.csv`), toCsv(extracted));
    counts[table] = extracted.length;
  }
  return counts;
}
