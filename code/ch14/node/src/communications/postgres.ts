// Notice repository in PostgreSQL. The primary key guarantees, in the database,
// that the same notice is not saved twice.
import pg from "pg";
import type { NoticeRepository } from "./domain.ts";

export class PostgresNotices implements NoticeRepository {
  readonly #db: pg.Client;

  constructor(db: pg.Client) {
    this.#db = db;
  }

  static async connect(url: string) {
    const db = new pg.Client({ connectionString: url });
    await db.connect();
    await db.query(`
      DROP TABLE IF EXISTS notices;
      CREATE TABLE notices (id text PRIMARY KEY, text text NOT NULL)`);
    return { notices: new PostgresNotices(db), close: () => db.end() };
  }

  async alreadySent(id: string) {
    const { rows } = await this.#db.query("SELECT 1 FROM notices WHERE id = $1", [id]);
    return rows.length > 0;
  }

  async record(id: string, text: string) {
    await this.#db.query("INSERT INTO notices VALUES ($1, $2)", [id, text]);
  }
}
