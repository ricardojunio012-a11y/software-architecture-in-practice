// Base backup, WAL archiving, and restore on a separate instance.
// It is what a managed service does under the hood of "point-in-time restore".
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { sleep } from "./common.ts";

const asPostgres = (program: string, args: string[], password?: string) =>
  execFileSync("su-exec", ["postgres", program, ...args], {
    env: { ...process.env, ...(password ? { PGPASSWORD: password } : {}) },
    stdio: "pipe",
  });

// Physical copy of the whole database, taken with the database live
export function baseBackup(target: string): void {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  execFileSync("chown", ["postgres:postgres", path.dirname(target)]);
  const args = ["-h", "db", "-U", "replicator", "-D", target];
  asPostgres("pg_basebackup", [...args, "-X", "stream", "-c", "fast"], "replicator");
}

// Closes the current WAL segment and waits for it to reach the archive. Without
// this, the latest transactions live only on the server's disk
export async function closeSegment(db: pg.Client): Promise<void> {
  const { rows } = await db.query("SELECT pg_walfile_name(pg_switch_wal()) AS s");
  for (let i = 0; i < 300; i++) {
    const r = await db.query("SELECT last_archived_wal AS a FROM pg_stat_archiver");
    if (r.rows[0].a !== null && r.rows[0].a >= rows[0].s) return;
    await sleep(100);
  }
  throw new Error(`segment ${rows[0].s} did not reach the archive`);
}

export const RESTORED = {
  host: "localhost",
  port: 5433,
  user: "morada",
  password: "morada",
  database: "morada",
};

// Starts a new instance from a copy of the base backup, replays the archived WAL
// up to the target (or to the end of the archive), and promotes it
export async function restore(base: string, target: string, until?: string) {
  fs.rmSync(target, { recursive: true, force: true });
  execFileSync("cp", ["-a", base, target]); // never restore over the only copy
  const conf = [
    "port = 5433",
    "listen_addresses = 'localhost'",
    "unix_socket_directories = '/tmp'",
    "archive_mode = off",
    "restore_command = 'cp /archive/%f %p'",
  ];
  if (until) {
    conf.push(`recovery_target_time = '${until}'`);
    conf.push("recovery_target_inclusive = off");
    conf.push("recovery_target_action = 'promote'");
  }
  fs.appendFileSync(path.join(target, "postgresql.auto.conf"), conf.join("\n") + "\n");
  fs.writeFileSync(path.join(target, "recovery.signal"), "");
  execFileSync("chown", ["-R", "postgres:postgres", target]);
  const log = path.join(target, "restore.log");
  try {
    asPostgres("pg_ctl", ["-D", target, "-l", log, "-w", "-t", "120", "start"]);
  } catch (error) {
    console.error(fs.readFileSync(log, "utf8"));
    throw error;
  }
  // The server accepts connections during recovery; wait for the promotion
  for (let i = 0; i < 600; i++) {
    const db = new pg.Client(RESTORED);
    await db.connect();
    const { rows } = await db.query("SELECT pg_is_in_recovery() AS r");
    if (!rows[0].r) return db;
    await db.end();
    await sleep(100);
  }
  throw new Error("the restored instance did not leave recovery");
}

export function stopRestored(target: string): void {
  asPostgres("pg_ctl", ["-D", target, "-m", "fast", "-w", "stop"]);
}

// Copies a table from the restored instance to production. pipefail: if pg_dump
// fails, the whole command fails, instead of psql receiving nothing
export function copyTable(table: string, databaseUrl: string): void {
  const r = RESTORED;
  const source = `-h ${r.host} -p ${r.port} -U ${r.user} -d ${r.database}`;
  const dump = `pg_dump ${source} -t ${table} --no-owner --no-privileges`;
  const load = `psql -q -v ON_ERROR_STOP=1 "${databaseUrl}"`;
  execSync(`set -o pipefail; ${dump} | ${load}`, {
    env: { ...process.env, PGPASSWORD: r.password },
    stdio: "pipe",
  });
}
