// Lab for chapter 37.
//   naive        the former resident is deleted only from the directory; events and
//                backup keep them
//   erasure      one key per consumer; destroying the key erases every copy
//   audit-trail  the hash-chained audit trail, attacked in four ways
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { Vault } from "./vault.ts";
import { FORMER_RESIDENT, events, residents } from "./data.ts";
import * as c from "./consumers.ts";
import { type Anchor, chain, type Entry, verify } from "./trail.ts";

const [version, root] = process.argv.slice(2);
const output = path.join(root, "output", version);
const backups = path.join(root, "output", "backups");
const lines: string[] = [];
const say = (s = "") => {
  lines.push(s);
  console.log(s);
};
const connect = async (url = process.env.DATABASE_URL) => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
};

// Looks for the former resident's name, SSN, or email, in plain text, in each table
async function searchDatabase(db: pg.Client): Promise<string[]> {
  const r = residents[FORMER_RESIDENT - 1];
  const tables = [
    "directory.residents",
    "directory.charges",
    "events.published",
    "audit.trail",
  ];
  const found = [];
  for (const table of tables) {
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM ${table} x WHERE x::text LIKE ANY ($1)`,
      [[r.name, r.ssn, r.email].map((s) => `%${s}%`)],
    );
    found.push(`   ${table.padEnd(22)}${rows[0].n}`);
  }
  return found;
}

function searchBackup(file: string): number {
  const r = residents[FORMER_RESIDENT - 1];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => [r.name, r.ssn, r.email].some((s) => l.includes(s))).length;
}

// The nightly backup: pg_dump of the production database, without the key vault
function nightlyBackup(withoutVault: boolean): string {
  fs.mkdirSync(backups, { recursive: true });
  const file = path.join(backups, `${version}.sql`);
  const excluded = withoutVault ? ["--exclude-schema=vault"] : [];
  execFileSync("pg_dump", [
    "--no-owner",
    "--no-privileges",
    ...excluded,
    "-f",
    file,
    process.env.DATABASE_URL!,
  ]);
  return file;
}

// Restores the backup into a separate database, as one would after a disaster
async function restore(db: pg.Client, file: string): Promise<pg.Client> {
  await db.query("DROP DATABASE IF EXISTS restore");
  await db.query("CREATE DATABASE restore");
  const url = process.env.RESTORE_URL!;
  execFileSync("psql", ["-q", "-v", "ON_ERROR_STOP=1", "-f", file, url]);
  return connect(url);
}

async function record(db: pg.Client, next: Omit<Entry, "seq" | "previous" | "hash">) {
  const { rows } = await db.query(
    "SELECT * FROM audit.trail ORDER BY seq DESC LIMIT 1",
  );
  const e = chain(rows[0], next);
  await db.query("INSERT INTO audit.trail VALUES ($1, $2, $3, $4, $5, $6, $7)", [
    e.seq,
    e.time,
    e.actor,
    e.action,
    e.target,
    e.previous,
    e.hash,
  ]);
}

const readTrail = async (db: pg.Client): Promise<Entry[]> =>
  (await db.query("SELECT * FROM audit.trail ORDER BY seq")).rows;

const outcome = (problems: string[]) =>
  problems.length ? problems.join("; ") : "intact";

async function prepareDatabase(db: pg.Client) {
  await db.query(fs.readFileSync(path.join(root, "sql", "schema.sql"), "utf8"));
}

async function deletion(db: pg.Client, encrypt: boolean) {
  const master = Buffer.from(process.env.MASTER_KEY ?? "", "hex");
  if (encrypt && master.length !== 32) throw new Error("invalid MASTER_KEY");
  const vault = encrypt ? new Vault(db, master) : undefined;
  const r = residents[FORMER_RESIDENT - 1];

  for (const resident of residents) await c.register(db, vault, resident);
  const evs = events();
  for (const e of evs) await c.publish(db, vault, e);
  const n = residents.length;
  say(`1. Directory with ${n} residents and ${evs.length} published events`);
  const file = nightlyBackup(encrypt);
  say(`2. Nightly backup with pg_dump${encrypt ? ", without the vault schema" : ""}`);

  say(`3. ${r.name} (consumer ${r.consumer}, unit ${r.unit}) moves out`);
  const copy = await c.exportData(db, vault, r.consumer);
  fs.writeFileSync(path.join(output, "export.json"), JSON.stringify(copy, null, 2));
  say(
    `   asks for a copy of the data (right to know): 1 directory record, ` +
      `${copy.charges.length} charge, ${copy.events.length} events`,
  );
  const desk = { time: "2026-10-20T11:00", actor: "privacy.desk" };
  await record(db, { ...desk, action: "exported", target: `consumer:${r.consumer}` });
  if (vault) await c.forget(db, vault, r.consumer);
  else await c.deleteFromDirectory(db, r.consumer);
  await record(db, { ...desk, action: "deleted", target: `consumer:${r.consumer}` });
  say(
    `   and the deletion: ${vault ? "directory row deleted, key destroyed" : "DELETE"}`,
  );

  say("4. Where his name, SSN, or email still appears in plain text");
  for (const line of await searchDatabase(db)) say(line);
  say(`   ${"nightly backup".padEnd(22)}${searchBackup(file)} lines`);

  say("5. Trying to read what is left");
  const { rows } = await db.query(
    "SELECT consumer, data FROM events.published ORDER BY seq",
  );
  const readable = async (list: typeof rows) => {
    let n = 0;
    for (const e of list) if (await c.reveal(vault, e.consumer, e.data)) n++;
    return n;
  };
  const his = rows.filter((e) => e.consumer === r.consumer);
  const others = rows.filter((e) => e.consumer !== r.consumer);
  say(`   his events: ${his.length} published, ${await readable(his)} readable`);
  say(
    `   other residents' events: ${others.length} published, ` +
      `${await readable(others)} readable`,
  );
  const restored = await restore(db, file);
  const { rows: dir } = await restored.query(
    "SELECT consumer, name, ssn, email FROM directory.residents ORDER BY consumer",
  );
  await restored.end();
  const names = [];
  for (const row of dir) {
    const plain = await c.reveal(vault, row.consumer, {
      name: row.name,
      ssn: row.ssn,
      email: row.email,
    });
    names.push(plain ? plain.name : `consumer ${row.consumer} unreadable`);
  }
  say(`   restored backup: ${names.join(", ")}`);
  const { rows: charges } = await db.query(
    "SELECT unit, amount_cents FROM directory.charges WHERE consumer = $1",
    [r.consumer],
  );
  say(`6. His charges kept (legal obligation): ${charges.length}`);
  const trail = await readTrail(db);
  say(`7. Audit trail: ${trail.length} entries, ${outcome(verify(trail))}`);
}

// The trail used in the attack: eight entries from one day of operation
const day: Omit<Entry, "seq" | "previous" | "hash">[] = [
  {
    time: "2026-10-20T09:00",
    actor: "president.anna",
    action: "viewed",
    target: "consumer:3",
  },
  {
    time: "2026-10-20T09:05",
    actor: "frontdesk.john",
    action: "logged",
    target: "unit:302",
  },
  {
    time: "2026-10-20T10:12",
    actor: "support.brian",
    action: "exported",
    target: "community:12",
  },
  {
    time: "2026-10-20T11:00",
    actor: "privacy.desk",
    action: "received",
    target: "request:88",
  },
  {
    time: "2026-10-20T11:30",
    actor: "privacy.desk",
    action: "exported",
    target: "consumer:3",
  },
  {
    time: "2026-10-20T11:31",
    actor: "privacy.desk",
    action: "deleted",
    target: "consumer:3",
  },
  {
    time: "2026-10-20T14:00",
    actor: "president.anna",
    action: "viewed",
    target: "consumer:1",
  },
  {
    time: "2026-10-20T23:00",
    actor: "system",
    action: "copied",
    target: "backup:nightly",
  },
];

async function auditTrail(owner: pg.Client) {
  const app = await connect(process.env.APP_URL);
  const restart = async () => {
    await owner.query("SET session_replication_role = replica");
    await owner.query("DELETE FROM audit.trail");
    await owner.query("RESET session_replication_role");
    for (const e of day) await record(app, e);
  };
  await restart();
  const entries = await readTrail(app);
  say("1. Eight entries written by the application");
  for (const e of entries)
    say(
      `   ${e.seq} ${e.time} ${e.actor} ${e.action} ${e.target} ${e.hash.slice(0, 12)}`,
    );
  // The anchor: the hash of the last entry, published outside the database
  const anchor: Anchor = { seq: 8, hash: entries[7].hash };
  fs.writeFileSync(path.join(output, "anchor.json"), JSON.stringify(anchor, null, 2));
  say(`   anchor published outside the database: entry 8, ${anchor.hash.slice(0, 12)}`);
  say(`   verification: ${outcome(verify(entries, anchor))}`);

  const attempt = async (db: pg.Client, sql: string) => {
    try {
      await db.query(sql);
      return "accepted";
    } catch (e) {
      return `refused (${(e as { code: string }).code}, ${(e as Error).message})`;
    }
  };
  const disguise = "UPDATE audit.trail SET actor = 'system' WHERE seq = 3";
  say("2. The application tries to change the author of entry 3");
  say(`   ${await attempt(app, disguise)}`);
  say("3. The database owner tries the same");
  say(`   ${await attempt(owner, disguise)}`);

  const withoutTriggers = async (sql: string) => {
    await owner.query("SET session_replication_role = replica");
    await owner.query(sql);
    await owner.query("RESET session_replication_role");
  };
  say("4. The owner turns off the triggers and changes the author of entry 3");
  await withoutTriggers(disguise);
  say(`   verification: ${outcome(verify(await readTrail(app)))}`);

  say("5. He changes entry 3 and recomputes the hashes from 3 to 8");
  await restart();
  const rewrite: Entry[] = [];
  for (const e of await readTrail(app)) {
    const original = e.seq === 3 ? { ...e, actor: "system" } : e;
    const next = e.seq < 3 ? e : chain(rewrite.at(-1), original);
    rewrite.push(next);
  }
  for (const e of rewrite.slice(2))
    await withoutTriggers(
      `UPDATE audit.trail SET actor = '${e.actor}', previous = '${e.previous}', ` +
        `hash = '${e.hash}' WHERE seq = ${e.seq}`,
    );
  const rewritten = await readTrail(app);
  say(`   verification without the anchor: ${outcome(verify(rewritten))}`);
  say(`   verification with the anchor: ${outcome(verify(rewritten, anchor))}`);

  say("6. He deletes entry 5");
  await restart();
  await withoutTriggers("DELETE FROM audit.trail WHERE seq = 5");
  say(`   verification: ${outcome(verify(await readTrail(app), anchor))}`);

  say("7. He deletes entries 7 and 8, the end of the trail");
  await restart();
  await withoutTriggers("DELETE FROM audit.trail WHERE seq >= 7");
  const cut = await readTrail(app);
  say(`   verification without the anchor: ${outcome(verify(cut))}`);
  say(`   verification with the anchor: ${outcome(verify(cut, anchor))}`);
  await app.end();
}

const titles: Record<string, string> = {
  naive: "the former resident deleted only from the directory",
  erasure: "crypto-shredding, one key per consumer",
  "audit-trail": "the hash-chained audit trail",
};
if (!titles[version]) throw new Error(`unknown version: ${version}`);
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
say(`Chapter 37, version ${version}: ${titles[version]}`);
say();
const db = await connect();
await prepareDatabase(db);
if (version === "audit-trail") await auditTrail(db);
else await deletion(db, version === "erasure");
await db.end();
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
