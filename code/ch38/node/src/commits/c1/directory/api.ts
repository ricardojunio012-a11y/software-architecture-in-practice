// Directory: owner of the units
import type { Db } from "../../../db.ts";

export type Unit = { id: number; name: string };

export function unitsOf(db: Db, community: number): Promise<Unit[]> {
  return db.query<Unit>(
    "select id, name from directory.units where community = $1 order by id",
    [community],
  );
}
