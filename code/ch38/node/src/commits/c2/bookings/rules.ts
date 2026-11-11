// Commit c2: Bookings checks the balance directly in the charges table (a shortcut)
import type { Db } from "../../../db.ts";

export async function canBook(db: Db, unit: number): Promise<boolean> {
  const [row] = await db.query<{ overdue: number }>(
    `select count(*)::int as overdue from billing.charges
      where unit = $1 and not paid and due_date < current_date`,
    [unit],
  );
  return row.overdue === 0;
}
