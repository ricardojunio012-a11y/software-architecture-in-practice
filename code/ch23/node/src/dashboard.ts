// The board president's billing dashboard with cache-aside in Redis: look in the
// cache; on a miss, query the database and store the result with a TTL. Three ways
// to fetch, which differ only in what happens when many requests miss the key.
import { randomUUID } from "node:crypto";
import type { RedisClientType } from "redis";

export interface Dashboard {
  received_cents: number;
  outstanding_cents: number;
}

export type Source = (community: number) => Promise<Dashboard>;

const TTL_S = 60;
const key = (community: number) => `dashboard:${community}`;

// Takes the lock only if it is free (NX), with a TTL (PX), and returns the owner
export async function acquireLock(
  redis: RedisClientType,
  name: string,
  ttlMs: number,
): Promise<string | null> {
  const owner = randomUUID();
  const acquired = await redis.set(name, owner, { NX: true, PX: ttlMs });
  return acquired ? owner : null;
}

// The lock has an owner. Whoever takes it writes a random value into it; to release
// it, a script compares the value and deletes it in a single operation, inside Redis.
// Without this, if the load outlasts the TTL, the lock expires, another process takes
// it, and the first one deletes the other's lock
const RELEASE =
  'if redis.call("get", KEYS[1]) == ARGV[1] then ' +
  'return redis.call("del", KEYS[1]) else return 0 end';

export async function releaseLock(
  redis: RedisClientType,
  name: string,
  owner: string,
): Promise<boolean> {
  return (await redis.eval(RELEASE, { keys: [name], arguments: [owner] })) === 1;
}

export class CachedDashboard {
  readonly #redis: RedisClientType;
  readonly #source: Source;
  readonly #inFlight = new Map<number, Promise<Dashboard>>();

  constructor(redis: RedisClientType, source: Source) {
    this.#redis = redis;
    this.#source = source;
  }

  async #readCache(community: number): Promise<Dashboard | null> {
    const cached = await this.#redis.get(key(community));
    return cached ? JSON.parse(cached) : null;
  }

  async #load(community: number): Promise<Dashboard> {
    const dashboard = await this.#source(community);
    await this.#redis.set(key(community), JSON.stringify(dashboard), {
      EX: TTL_S,
    });
    return dashboard;
  }

  // No protection: every request that misses the key goes to the database
  async unprotected(community: number): Promise<Dashboard> {
    return (await this.#readCache(community)) ?? this.#load(community);
  }

  // Shared promise: within the same process, later requests wait for the load that is
  // already in flight instead of starting another one
  async withPromise(community: number): Promise<Dashboard> {
    const cached = await this.#readCache(community);
    if (cached) return cached;
    let load = this.#inFlight.get(community);
    if (!load) {
      load = this.#load(community).finally(() => this.#inFlight.delete(community));
      this.#inFlight.set(community, load);
    }
    return load;
  }

  // Lock in Redis: across processes, only whoever gets the lock goes to the database;
  // the others wait for the value to show up in the cache
  async withLock(community: number): Promise<Dashboard> {
    const cached = await this.#readCache(community);
    if (cached) return cached;
    const lock = `lock:${key(community)}`;
    const owner = await acquireLock(this.#redis, lock, 5000);
    if (owner) {
      try {
        return await this.#load(community);
      } finally {
        await releaseLock(this.#redis, lock, owner);
      }
    }
    for (let i = 0; i < 150; i++) {
      await new Promise((ok) => setTimeout(ok, 20));
      const ready = await this.#readCache(community);
      if (ready) return ready;
    }
    // Whoever held the lock failed: go to the database instead of waiting forever
    return this.#load(community);
  }

  // After a change, the cached data is stale: delete it, and the next read reloads it
  async invalidate(community: number) {
    await this.#redis.del(key(community));
  }
}
