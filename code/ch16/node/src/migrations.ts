// Versioned migrations: each file in migrations/ runs only once, in order, and is
// recorded in the applied_migrations table. A file that starts with
// "-- no transaction" runs outside a transaction (CREATE INDEX CONCURRENTLY needs it).
import fs from "node:fs";
import path from "node:path";
import type pg from "pg";

export async function applyMigrations(
  db: pg.Client,
  folder: string,
  upTo = Infinity,
): Promise<string[]> {
  await db.query(`CREATE TABLE IF NOT EXISTS applied_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const { rows } = await db.query("SELECT version FROM applied_migrations");
  const done = new Set(rows.map((r) => r.version));
  const applied: string[] = [];
  const files = fs
    .readdirSync(folder)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (parseInt(file) > upTo) break;
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(folder, file), "utf8");
    const record = "INSERT INTO applied_migrations (version) VALUES ($1)";
    if (sql.startsWith("-- no transaction")) {
      await db.query(sql);
      await db.query(record, [file]);
    } else {
      // The migration and its record go in together, or neither does
      await db.query("BEGIN");
      try {
        await db.query(sql);
        await db.query(record, [file]);
        await db.query("COMMIT");
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      }
    }
    applied.push(file);
  }
  return applied;
}
