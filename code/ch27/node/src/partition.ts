// The "async" and "sync" versions: Toxiproxy cuts the network between the leader and
// the replica, and the board president changes the community's quiet hours.
//  async: the leader accepts the write at once, and the replica keeps showing the old
//         value while the network is cut (available, inconsistent).
//  sync:  the leader confirms the write only when the replica receives it; with the
//         network cut, the write keeps waiting (consistent, unavailable).
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const [data, version] = process.argv.slice(2);
const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const leader = new pg.Client({ connectionString: process.env.PRIMARY_URL });
const replica = new pg.Client({ connectionString: process.env.REPLICA_URL });
await Promise.all([leader.connect(), replica.connect()]);

// Cuts (or restores) the network between the leader and both replicas
async function network(up: boolean) {
  for (const proxy of ["replication", "candidate"])
    await fetch(`${process.env.TOXIPROXY_URL}/proxies/${proxy}`, {
      method: "POST",
      body: JSON.stringify({ enabled: up }),
    });
}

async function quietStart(db: pg.Client) {
  const sql = "SELECT quiet_start FROM rules WHERE community_id = 12";
  const { rows } = await db.query(sql);
  return rows[0]?.quiet_start ?? "(no rule)";
}

async function waitForReplica(value: string) {
  while ((await quietStart(replica).catch(() => "")) !== value) await wait(200);
}

// Setup: asynchronous replication, network up, rule copied to the replica
await network(true);
await leader.query("ALTER SYSTEM SET synchronous_standby_names = ''");
await leader.query("SELECT pg_reload_conf()");
await leader.query("DROP TABLE IF EXISTS rules");
await leader.query(
  "CREATE TABLE rules (community_id integer PRIMARY KEY, quiet_start text)",
);
await leader.query("INSERT INTO rules VALUES (12, '22:00')");
await waitForReplica("22:00");
if (version === "sync") {
  await leader.query("ALTER SYSTEM SET synchronous_standby_names = '*'");
  await leader.query("SELECT pg_reload_conf()");
}

const name = version === "sync" ? "synchronous" : "asynchronous";
const lines = [`${name} replication`, "before: leader 22:00, replica 22:00"];
await network(false);
lines.push("the network between the leader and the replica is cut");

// The board president moves quiet hours to 23:00; the write has 2 seconds to be
// confirmed
const write = leader.query(
  "UPDATE rules SET quiet_start = '23:00' WHERE community_id = 12",
);
const result = await Promise.race([
  write.then(() => "confirmed"),
  wait(2000).then(() => "not confirmed after 2 s (waiting for the replica)"),
]);
lines.push(`write on the leader: ${result}`);
if (result === "confirmed") {
  lines.push(
    `read on the leader: ${await quietStart(leader)}`,
    `read on the replica: ${await quietStart(replica)} (stale)`,
  );
}

await network(true);
await write;
await waitForReplica("23:00");
lines.push(
  "the network comes back",
  result === "confirmed"
    ? "the replica catches up with the leader"
    : "the replica receives the write, and the leader finally confirms it",
  `after: leader ${await quietStart(leader)}, replica ${await quietStart(replica)}`,
);

await leader.query("ALTER SYSTEM SET synchronous_standby_names = ''");
await leader.query("SELECT pg_reload_conf()");
await Promise.all([leader.end(), replica.end()]);
const output = path.join(data, "output", version);
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
