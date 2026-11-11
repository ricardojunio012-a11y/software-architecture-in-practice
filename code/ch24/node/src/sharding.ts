// The "sharding" version: the charges of nine communities in three databases, with
// the routing in the application. Queries for one community go to a single database;
// the report for all of them goes to all three (scatter-gather). At the end, a logical
// shard moves to another database.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { makeId, readId } from "./ids.ts";
import { Router } from "./router.ts";

const data = process.argv[2];
const BASE_URL = process.env.SHARDS_URL!;
const PHYSICAL = ["shard0", "shard1", "shard2"];

// Sets up three empty databases
const admin = new pg.Client({ connectionString: BASE_URL + "morada" });
await admin.connect();
for (const name of PHYSICAL) {
  await admin.query(`DROP DATABASE IF EXISTS ${name}`);
  await admin.query(`CREATE DATABASE ${name}`);
}
await admin.end();
const dbs = new Map<string, pg.Client>();
for (const name of PHYSICAL) {
  const db = new pg.Client({ connectionString: BASE_URL + name });
  await db.connect();
  await db.query(
    "CREATE TABLE charges (id bigint PRIMARY KEY, community_id integer, " +
      "amount_cents integer, status text)",
  );
  dbs.set(name, db);
}

// 12 logical shards in 3 databases: 0-3 on shard0, 4-7 on shard1, 8-11 on shard2
const map: Record<number, string> = {};
for (let l = 0; l < 12; l++) map[l] = PHYSICAL[Math.floor(l / 4)];
const router = new Router(map);
const db = (community: number) => dbs.get(router.physical(community))!;

// Three charges per community, at a fixed "time", so the IDs are always the same
const now = Date.UTC(2026, 9, 25, 12, 0, 0);
let sequence = 0;
for (let c = 1; c <= 9; c++) {
  for (let i = 0; i < 3; i++) {
    const id = makeId(now, router.logicalShard(c), sequence++);
    await db(c).query("INSERT INTO charges VALUES ($1, $2, $3, $4)", [
      id.toString(),
      c,
      40000 + c * 1000,
      i === 0 ? "open" : "paid",
    ]);
  }
}

const lines: string[] = ["27 charges from 9 communities in 3 databases"];
for (const name of PHYSICAL) {
  const { rows } = await dbs
    .get(name)!
    .query(
      "SELECT string_agg(DISTINCT community_id::text, ', ') AS c, count(*) AS n " +
        "FROM charges",
    );
  lines.push(`  ${name}: ${rows[0].n} charges, communities ${rows[0].c}`);
}

const ofSeven = await db(7).query(
  "SELECT count(*) AS n FROM charges WHERE community_id = 7",
);
lines.push(
  `charges for community 7: ${ofSeven.rows[0].n}, ` +
    `querying only ${router.physical(7)}`,
);

// Without the community, the query must go to every database and merge the answers
const dollars = (c: number) =>
  (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
let open = 0;
for (const name of router.all()) {
  const { rows } = await dbs
    .get(name)!
    .query(
      "SELECT coalesce(sum(amount_cents), 0) AS t FROM charges " +
        "WHERE status = 'open'",
    );
  open += Number(rows[0].t);
}
lines.push(
  `open across all communities: $${dollars(open)}, ` +
    `querying ${router.all().length} databases`,
);

const { rows: oneId } = await db(7).query(
  "SELECT id FROM charges WHERE community_id = 7 ORDER BY id LIMIT 1",
);
const decoded = readId(BigInt(oneId[0].id));
lines.push(
  `an ID from community 7: ${oneId[0].id}`,
  `  created at ${decoded.createdAt}, logical shard ${decoded.logicalShard}, ` +
    `sequence ${decoded.sequence}`,
);

// Moves community 7's logical shard to shard2: copy, change the map, delete the source
const logical = router.logicalShard(7);
const source = dbs.get(router.physical(7))!;
const target = dbs.get("shard2")!;
const { rows: toCopy } = await source.query(
  "SELECT * FROM charges WHERE community_id % 12 = $1",
  [logical],
);
for (const r of toCopy) {
  await target.query("INSERT INTO charges VALUES ($1, $2, $3, $4)", [
    r.id,
    r.community_id,
    r.amount_cents,
    r.status,
  ]);
}
router.move(logical, "shard2");
await source.query("DELETE FROM charges WHERE community_id % 12 = $1", [logical]);
const after = await db(7).query(
  "SELECT count(*) AS n FROM charges WHERE community_id = 7",
);
lines.push(
  `logical shard ${logical} moved to shard2 (${toCopy.length} charges copied)`,
  `charges for community 7: ${after.rows[0].n}, ` +
    `querying only ${router.physical(7)}`,
);

await Promise.all([...dbs.values()].map((b) => b.end()));
const output = path.join(data, "output", "sharding");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
