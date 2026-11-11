// Commit c1: the delinquency dashboard with one aggregate query
import type { Db } from "../../../db.ts";
import { unitsOf } from "../directory/api.ts";
import { TODAY } from "./api.ts";

export type Row = { unit: string; outstanding: number };

export async function delinquencyDashboard(db: Db, community: number): Promise<Row[]> {
  const units = await unitsOf(db, community);
  const balances = await db.query<{ unit: number; total: string }>(
    `select unit, sum(amount) as total from billing.charges
      where community = $1 and not paid and due_date < $2
      group by unit`,
    [community, TODAY],
  );
  const total = new Map(balances.map((b) => [b.unit, Number(b.total)]));
  return units
    .filter((u) => total.has(u.id))
    .map((u) => ({ unit: u.name, outstanding: total.get(u.id)! }));
}
