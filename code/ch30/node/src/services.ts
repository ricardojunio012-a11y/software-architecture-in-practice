// The four onboarding services and the notifications service. Each function uses only
// its own schema and is idempotent: called twice with the same saga, it has the same
// effect.
import type pg from "pg";

export interface Resident {
  name: string;
  taxId: string;
  unit: string;
}

export async function signContract(db: pg.Client, saga: string, community: string) {
  await db.query(
    "INSERT INTO contracts.contracts (saga, community, status) " +
      "VALUES ($1, $2, 'signed') " +
      "ON CONFLICT (saga) DO NOTHING",
    [saga, community],
  );
}

// The compensation does not delete the contract: it records the cancellation and why
export async function cancelContract(db: pg.Client, saga: string, reason: string) {
  await db.query(
    "UPDATE contracts.contracts SET status = 'canceled', reason = $2 WHERE saga = $1",
    [saga, reason],
  );
}

export async function issueCharge(
  db: pg.Client,
  saga: string,
  community: string,
  amountCents: number,
) {
  await db.query(
    "INSERT INTO billing.entries (key, community, kind, amount_cents) " +
      "VALUES ($1, $2, 'charge', $3) ON CONFLICT (key) DO NOTHING",
    [`${saga}:charge`, community, amountCents],
  );
}

// The compensation of the charge is a reversal, a new entry for the same amount
export async function reverseCharge(db: pg.Client, saga: string) {
  await db.query(
    "INSERT INTO billing.entries (key, community, kind, amount_cents) " +
      "SELECT $2, community, 'reversal', amount_cents FROM billing.entries " +
      "WHERE key = $1 ON CONFLICT (key) DO NOTHING",
    [`${saga}:charge`, `${saga}:reversal`],
  );
}

export async function provisionTenant(db: pg.Client, saga: string, community: string) {
  await db.query(
    "INSERT INTO platform.tenants (saga, community, status) " +
      "VALUES ($1, $2, 'active') " +
      "ON CONFLICT (saga) DO NOTHING",
    [saga, community],
  );
}

export async function deactivateTenant(db: pg.Client, saga: string) {
  await db.query("UPDATE platform.tenants SET status = 'deactivated' WHERE saga = $1", [
    saga,
  ]);
}

// The structure of a tax ID (SSN or ITIN): nine digits, and the Social Security
// Administration never assigns area 000, 666 or 900-999, group 00 or serial 0000
export function isValidTaxId(taxId: string): boolean {
  const m = /^(\d{3})-(\d{2})-(\d{4})$/.exec(taxId);
  if (!m) return false;
  const [, area, group, serial] = m;
  if (area === "000" || area === "666" || area >= "900") return false;
  return group !== "00" && serial !== "0000";
}

// The import is all or nothing inside the service itself: a local transaction
export async function importResidents(
  db: pg.Client,
  saga: string,
  residents: Resident[],
) {
  await db.query("BEGIN");
  try {
    await db.query("DELETE FROM directory.residents WHERE saga = $1", [saga]);
    for (const [i, r] of residents.entries()) {
      if (!isValidTaxId(r.taxId))
        throw new Error(`line ${i + 1}: invalid tax ID (${r.taxId})`);
      await db.query(
        "INSERT INTO directory.residents (saga, name, tax_id, unit) " +
          "VALUES ($1, $2, $3, $4)",
        [saga, r.name, r.taxId, r.unit],
      );
    }
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

export async function removeResidents(db: pg.Client, saga: string) {
  await db.query("DELETE FROM directory.residents WHERE saga = $1", [saga]);
}

// The step that cannot be undone: a sent email does not come back
export async function sendWelcome(db: pg.Client, saga: string, community: string) {
  await db.query(
    "INSERT INTO notifications.sent (key, community, recipients) " +
      "SELECT $1, $2, count(*) FROM directory.residents WHERE saga = $1 " +
      "ON CONFLICT (key) DO NOTHING",
    [saga, community],
  );
}
