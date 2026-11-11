// Billing: owner of the charges and of the delinquency rule
import type { Db } from "../../../db.ts";

export const TODAY = "2026-10-06";

export async function unitInGoodStanding(db: Db, unit: number): Promise<boolean> {
  const [row] = await db.query<{ overdue: number }>(
    `select count(*)::int as overdue from billing.charges
      where unit = $1 and not paid and due_date < $2
        and not in_plan`,
    [unit, TODAY],
  );
  return row.overdue === 0;
}
