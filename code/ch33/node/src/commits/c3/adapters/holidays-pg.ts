// Commit c3: the holidays live in a PostgreSQL table
import pg from "pg";

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function isHoliday(date: string): Promise<boolean> {
  const r = await db.query("SELECT 1 FROM holidays WHERE day = $1", [date]);
  return (r.rowCount ?? 0) > 0;
}
