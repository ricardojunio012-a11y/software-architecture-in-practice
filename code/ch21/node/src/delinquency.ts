// The slowest route of the board president's dashboard: the units of the community
// with the open balance of each one. Two versions with the same result.

export interface Querier {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

export interface Row {
  unit: string;
  open_cents: number;
}

// N+1: one query for the units and one more for each unit. With 120 units, that is
// 121 round trips to the database, each one fast, all of them added up
export async function delinquencyN1(db: Querier, community: number) {
  const { rows: units } = await db.query(
    "SELECT id, code FROM units WHERE community_id = $1 ORDER BY code",
    [community],
  );
  const rows: Row[] = [];
  for (const u of units) {
    const { rows: found } = await db.query(
      "SELECT coalesce(sum(amount_cents), 0)::integer AS total FROM charges " +
        "WHERE unit_id = $1 AND status = 'open'",
      [u.id],
    );
    rows.push({ unit: u.code, open_cents: found[0].total });
  }
  return rows;
}

// Fixed: a single query, which the database resolves in one go
export async function delinquencyFixed(db: Querier, community: number) {
  const { rows } = await db.query(
    `SELECT u.code AS unit,
            coalesce(sum(c.amount_cents)
                     FILTER (WHERE c.status = 'open'), 0)::integer
              AS open_cents
     FROM units u LEFT JOIN charges c ON c.unit_id = u.id
     WHERE u.community_id = $1
     GROUP BY u.code ORDER BY u.code`,
    [community],
  );
  return rows as Row[];
}
