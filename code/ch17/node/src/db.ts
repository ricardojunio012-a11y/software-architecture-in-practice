// Connection to PostgreSQL and transactions on behalf of a community or a management
// company.
import pg from "pg";

export async function connect(url: string): Promise<pg.Client> {
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  return db;
}

// Runs a function in a transaction on behalf of the requester. The "true" in
// set_config makes the value last only for this transaction: on a connection reused
// from a pool, the previous request's community is not left over for the next one.
async function onBehalfOf<T>(
  db: pg.Client,
  setting: string,
  value: number | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.query("BEGIN");
  try {
    if (value !== null) {
      await db.query("SELECT set_config($1, $2, true)", [setting, String(value)]);
    }
    const result = await fn();
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

// The board president acts on behalf of one community. The management company acts
// on behalf of every community it manages, which the database policy looks up in the
// managed_communities table.
export const asCommunity = <T>(
  db: pg.Client,
  community: number | null,
  fn: () => Promise<T>,
) => onBehalfOf(db, "app.community", community, fn);

export const asManagementCompany = <T>(
  db: pg.Client,
  managementCompany: number,
  fn: () => Promise<T>,
) => onBehalfOf(db, "app.management_company", managementCompany, fn);
