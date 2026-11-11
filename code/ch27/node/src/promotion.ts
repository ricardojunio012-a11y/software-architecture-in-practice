// The "promotion" version (now the hard part): the network between the leader and the
// candidate is cut, and the monitor, unable to see the leader, promotes the candidate.
// Both sides accept writes (split brain). When the network comes back, the system
// follows the new leader, and the write the old leader confirmed to the board president
// no longer exists.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const connect = async (url: string) => {
  for (;;) {
    const c = new pg.Client({ connectionString: url });
    try {
      await c.connect();
      return c;
    } catch {
      await wait(500);
    }
  }
};
const leader = await connect(process.env.PRIMARY_URL!);
let candidate = await connect(process.env.CANDIDATE_URL!);

async function network(up: boolean) {
  await fetch(`${process.env.TOXIPROXY_URL}/proxies/candidate`, {
    method: "POST",
    body: JSON.stringify({ enabled: up }),
  });
}
async function quietStart(db: pg.Client) {
  const sql = "SELECT quiet_start FROM rules WHERE community_id = 12";
  const { rows } = await db.query(sql);
  return rows[0]?.quiet_start ?? "(no rule)";
}
async function inRecovery(db: pg.Client) {
  const { rows } = await db.query("SELECT pg_is_in_recovery() AS r");
  return rows[0].r as boolean;
}

// Asks the promoted candidate to rebuild itself from the leader (see db/candidate.sh)
// and waits for it to come back as a replica, with the leader's value
async function rebuildCandidate(value: string) {
  await network(true);
  await candidate.query("CREATE TABLE rebuild ()");
  await candidate.end().catch(() => {});
  for (;;) {
    await wait(1000);
    candidate = await connect(process.env.CANDIDATE_URL!);
    const ready = await inRecovery(candidate).catch(() => false);
    if (ready && (await quietStart(candidate).catch(() => "")) === value) return;
    await candidate.end().catch(() => {});
  }
}

// Setup: asynchronous replication, network up, the candidate as a replica with 22:00
await network(true);
await leader.query("ALTER SYSTEM SET synchronous_standby_names = ''");
await leader.query("SELECT pg_reload_conf()");
await leader.query("DROP TABLE IF EXISTS rules");
await leader.query(
  "CREATE TABLE rules (community_id integer PRIMARY KEY, quiet_start text)",
);
await leader.query("INSERT INTO rules VALUES (12, '22:00')");
if (!(await inRecovery(candidate))) await rebuildCandidate("22:00");
while ((await quietStart(candidate).catch(() => "")) !== "22:00") await wait(200);

const lines = [
  "promotion during the partition",
  "before: leader 22:00, candidate 22:00",
];
await network(false);
lines.push("the network between the leader and the candidate is cut");

await leader.query("UPDATE rules SET quiet_start = '23:00' WHERE community_id = 12");
lines.push("write on the old leader (23:00): confirmed to the board president");

// The monitor cannot see the leader and promotes the candidate. Nobody fences the old
// leader, which keeps accepting writes from whoever can still reach it
const { rows } = await candidate.query("SELECT pg_promote(true, 60) AS ok");
lines.push(`the candidate is promoted to leader: ${rows[0].ok ? "yes" : "no"}`);
await candidate.query("UPDATE rules SET quiet_start = '21:00' WHERE community_id = 12");
lines.push(
  "write on the new leader (21:00): confirmed to another user",
  `two leaders: the old one says ${await quietStart(leader)}, ` +
    `the new one says ${await quietStart(candidate)}`,
);

await network(true);
await wait(2000);
lines.push(
  "the network comes back",
  "did the candidate go back to following the old leader? " +
    ((await inRecovery(candidate)) ? "yes" : "no (it is on a new timeline)"),
  `the system now follows the new leader: ${await quietStart(candidate)}`,
  "the 23:00 write, confirmed to the board president, is lost",
);

await rebuildCandidate(await quietStart(leader));
await Promise.all([leader.end(), candidate.end()]);
const output = path.join(process.argv[2], "output", "promotion");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
