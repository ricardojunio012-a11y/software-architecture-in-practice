// The reserve fund: the balance is the sum of the entries, and a withdrawal can only
// be recorded if there is enough balance.
import type pg from "pg";

export async function setUpFund(db: pg.Client): Promise<void> {
  await db.query("TRUNCATE entries");
  await db.query("INSERT INTO funds VALUES (1, 1234) ON CONFLICT DO NOTHING");
  await db.query(
    "INSERT INTO entries (fund_id, amount_cents, description) " +
      "VALUES (1, 100000, 'opening balance')",
  );
}

export async function balance(db: pg.Client, fund: number): Promise<number> {
  const { rows } = await db.query(
    "SELECT coalesce(sum(amount_cents), 0)::int AS balance FROM entries " +
      "WHERE fund_id = $1",
    [fund],
  );
  return rows[0].balance;
}

export async function insertWithdrawal(
  db: pg.Client,
  fund: number,
  amount: number,
  description: string,
): Promise<void> {
  await db.query(
    "INSERT INTO entries (fund_id, amount_cents, description) VALUES ($1, $2, $3)",
    [fund, -amount, description],
  );
}

// The right way under READ COMMITTED: lock the fund row before reading the balance.
// Two withdrawals from the same fund then happen one after the other.
export async function recordWithdrawal(
  db: pg.Client,
  fund: number,
  amount: number,
  description: string,
): Promise<boolean> {
  await db.query("BEGIN");
  try {
    await db.query("SELECT id FROM funds WHERE id = $1 FOR UPDATE", [fund]);
    if ((await balance(db, fund)) < amount) {
      await db.query("ROLLBACK");
      return false;
    }
    await insertWithdrawal(db, fund, amount, description);
    await db.query("COMMIT");
    return true;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

// 123456 cents → "$1,234.56"; -30000 cents → "-$300.00"
export function dollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const whole = String(Math.floor(absolute / 100)).replace(/\B(?=(\d{3})+$)/g, ",");
  return `${sign}$${whole}.${String(absolute % 100).padStart(2, "0")}`;
}
