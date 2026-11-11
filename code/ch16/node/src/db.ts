// Connection to PostgreSQL and a clean schema for each experiment.
import pg from "pg";

export async function connect(url: string): Promise<pg.Client> {
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  return db;
}

export async function resetSchema(db: pg.Client): Promise<void> {
  await db.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
}
