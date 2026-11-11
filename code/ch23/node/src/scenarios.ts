// The "cache-aside" and "stampede" versions, with real Redis and PostgreSQL.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { createClient, type RedisClientType } from "redis";
import {
  type Dashboard,
  CachedDashboard,
  acquireLock,
  releaseLock,
} from "./dashboard.ts";

const [data, scenario] = process.argv.slice(2);
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
await db.query(fs.readFileSync(path.join(data, "sql", "data.sql"), "utf8"));
const redis = createClient({ url: process.env.REDIS_URL }) as RedisClientType;
await redis.connect();
await redis.flushAll();

let queries = 0;
async function source(community: number): Promise<Dashboard> {
  queries++;
  const { rows } = await db.query(
    "SELECT received_cents::integer, outstanding_cents::integer " +
      "FROM billing_dashboard($1)",
    [community],
  );
  return rows[0];
}
const dashboard = new CachedDashboard(redis, source);
const dollars = (c: number) =>
  (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
const show = (d: Dashboard) =>
  `received $${dollars(d.received_cents)}, ` +
  `outstanding $${dollars(d.outstanding_cents)}`;

const lines: string[] = [];
if (scenario === "cache-aside") {
  lines.push(
    `1st request: ${show(await dashboard.withPromise(12))} (queries: ${queries})`,
  );
  for (let i = 0; i < 5; i++) await dashboard.withPromise(12);
  lines.push(`5 more requests, from the cache (queries: ${queries})`);
  await db.query(
    "UPDATE charges SET status = 'paid' " +
      "WHERE id = (SELECT min(id) FROM charges WHERE status = 'open')",
  );
  lines.push(`without invalidating: ${show(await dashboard.withPromise(12))} (stale)`);
  await dashboard.invalidate(12);
  lines.push(
    `after invalidating: ${show(await dashboard.withPromise(12))} ` +
      `(queries: ${queries})`,
  );
} else {
  const strategies: [string, (c: number) => Promise<Dashboard>][] = [
    ["no protection", (c) => dashboard.unprotected(c)],
    ["shared promise", (c) => dashboard.withPromise(c)],
    ["lock in Redis", (c) => dashboard.withLock(c)],
  ];
  lines.push("200 concurrent requests, with the key not in the cache:");
  for (const [name, get] of strategies) {
    await redis.flushAll();
    queries = 0;
    const answers = await Promise.all(Array.from({ length: 200 }, () => get(12)));
    const same = new Set(answers.map((r) => JSON.stringify(r))).size === 1;
    lines.push(
      `  ${name.padEnd(23)} ${String(queries).padStart(3)} database ` +
        `${queries === 1 ? "query" : "queries"}` +
        `${same ? ", all responses identical" : ""}`,
    );
  }

  // The lock needs an owner: A's load outlasts the TTL, the lock expires, and B takes
  // it. When A finishes, it releases the lock in two ways
  lines.push("", "lock with a 100 ms TTL and a 200 ms load:");
  for (const withOwner of [false, true]) {
    await redis.flushAll();
    const a = (await acquireLock(redis, "lock:test", 100))!;
    await new Promise((ok) => setTimeout(ok, 200));
    const b = await acquireLock(redis, "lock:test", 5000);
    if (withOwner) await releaseLock(redis, "lock:test", a);
    else await redis.del("lock:test");
    const isB = b !== null && (await redis.get("lock:test")) === b;
    lines.push(
      withOwner
        ? `  compare and delete (Lua) ${isB ? "B's lock still belongs to B" : "ERROR"}`
        : `  delete without checking  ${isB ? "ERROR" : "A deleted B's lock"}`,
    );
  }
}

await Promise.all([db.end(), redis.quit()]);
const output = path.join(data, "output", scenario);
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
