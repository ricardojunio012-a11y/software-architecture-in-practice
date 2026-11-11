// Commit c3: the dashboard now sums the balance unit by unit
import type { Db } from "../../../db.ts";
import { unitsOf } from "../directory/api.ts";
import { TODAY } from "./api.ts";

export type Row = { unit: string; outstanding: number };

export async function delinquencyDashboard(db: Db, community: number): Promise<Row[]> {
  const rows: Row[] = [];
  for (const u of await unitsOf(db, community)) {
    const [b] = await db.query<{ total: string | null }>(
      `select sum(amount) as total from billing.charges
        where unit = $1 and not paid and due_date < $2`,
      [u.id, TODAY],
    );
    if (b.total !== null) rows.push({ unit: u.name, outstanding: Number(b.total) });
  }
  return rows;
}
