// The board president's delinquency report, with the defect the chapter uses to show
// the leak: the query forgot the community filter.
import type pg from "pg";

export interface Delinquent {
  community_id: number;
  unit: string;
  resident: string;
  amount_cents: number;
}

export async function delinquents(db: pg.Client): Promise<Delinquent[]> {
  const { rows } = await db.query(
    `SELECT community_id, unit, resident, amount_cents
     FROM charges
     WHERE status = 'open' -- missing: AND community_id = $1
     ORDER BY community_id, unit`,
  );
  return rows;
}
