// The key vault: one key per consumer, stored encrypted with the master key.
// In a real system, it is a key service (KMS) outside the application database.
import type pg from "pg";
import { newKey, unwrap, wrap } from "./crypto.ts";

export class Vault {
  private readonly db: pg.Client;
  private readonly master: Buffer;

  constructor(db: pg.Client, master: Buffer) {
    this.db = db;
    this.master = master;
  }

  async create(consumer: number): Promise<Buffer> {
    const key = newKey();
    await this.db.query(
      "INSERT INTO vault.keys (consumer, wrapped_key) VALUES ($1, $2)",
      [consumer, wrap(this.master, key)],
    );
    return key;
  }

  // Without a key, it returns undefined: the consumer's data became unreadable.
  async key(consumer: number): Promise<Buffer | undefined> {
    const { rows } = await this.db.query(
      "SELECT wrapped_key FROM vault.keys WHERE consumer = $1",
      [consumer],
    );
    return rows[0] && unwrap(this.master, rows[0].wrapped_key);
  }

  // Crypto-shredding: deleting the key makes every copy of the data unreadable.
  async destroy(consumer: number): Promise<void> {
    await this.db.query("DELETE FROM vault.keys WHERE consumer = $1", [consumer]);
  }
}
