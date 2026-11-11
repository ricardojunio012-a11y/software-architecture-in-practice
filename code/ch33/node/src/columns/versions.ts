// The versions of the resident directory code during the switch from the mobile
// column to the phone column. Each instance has its own connection, like two servers
// of the same application running different versions.
import pg from "pg";

type Sql = { read: string; change: string; register: string };

const IN_BOTH =
  "INSERT INTO residents (name, mobile, phone) VALUES ($1, $2, $2) RETURNING id";

const SQL: Record<string, Sql> = {
  // v1, the version in production: knows only the old column
  v1: {
    read: "SELECT mobile AS tel FROM residents WHERE id = $1",
    change: "UPDATE residents SET mobile = $2 WHERE id = $1",
    register: "INSERT INTO residents (name, mobile) VALUES ($1, $2) RETURNING id",
  },
  // v2, expand: writes to both columns and still reads from the old one
  v2: {
    read: "SELECT mobile AS tel FROM residents WHERE id = $1",
    change: "UPDATE residents SET mobile = $2, phone = $2 WHERE id = $1",
    register: IN_BOTH,
  },
  // v3, migrate: writes to both columns and starts reading from the new one
  v3: {
    read: "SELECT phone AS tel FROM residents WHERE id = $1",
    change: "UPDATE residents SET mobile = $2, phone = $2 WHERE id = $1",
    register: IN_BOTH,
  },
  // v4, contract: knows only the new column
  v4: {
    read: "SELECT phone AS tel FROM residents WHERE id = $1",
    change: "UPDATE residents SET phone = $2 WHERE id = $1",
    register: "INSERT INTO residents (name, phone) VALUES ($1, $2) RETURNING id",
  },
};

export class Instance {
  readonly version: string;
  #db: pg.Client;

  constructor(version: string, db: pg.Client) {
    this.version = version;
    this.#db = db;
  }

  static async start(version: string): Promise<Instance> {
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    return new Instance(version, db);
  }

  async read(id: number): Promise<string | null> {
    const r = await this.#db.query(SQL[this.version].read, [id]);
    return r.rows[0]?.tel ?? null;
  }

  async change(id: number, phone: string): Promise<void> {
    await this.#db.query(SQL[this.version].change, [id, phone]);
  }

  async register(name: string, phone: string): Promise<number> {
    const r = await this.#db.query(SQL[this.version].register, [name, phone]);
    return r.rows[0].id;
  }

  stop(): Promise<void> {
    return this.#db.end();
  }
}
