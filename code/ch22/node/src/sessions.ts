// Where the board president's session is kept. In the process's memory, it exists
// only on the replica that handled the login; in Redis, any replica finds it.
import { createClient } from "redis";

export interface SessionStore {
  create(id: string, boardPresident: string): Promise<void>;
  find(id: string): Promise<string | null>;
}

export class InMemorySessions implements SessionStore {
  readonly #map = new Map<string, string>();

  async create(id: string, boardPresident: string) {
    this.#map.set(id, boardPresident);
  }

  async find(id: string) {
    return this.#map.get(id) ?? null;
  }
}

const EIGHT_HOURS = 8 * 60 * 60;

export class RedisSessions implements SessionStore {
  readonly #redis: ReturnType<typeof createClient>;

  private constructor(redis: ReturnType<typeof createClient>) {
    this.#redis = redis;
  }

  // A constructor cannot wait for the connection. The factory does: if Redis is
  // down, the replica fails at startup, not with a stray error on the first request
  static async connect(url: string): Promise<RedisSessions> {
    const redis = createClient({ url });
    await redis.connect();
    return new RedisSessions(redis);
  }

  // The session expires on its own, as the cookie would
  async create(id: string, boardPresident: string) {
    await this.#redis.set(`session:${id}`, boardPresident, { EX: EIGHT_HOURS });
  }

  async find(id: string) {
    return this.#redis.get(`session:${id}`);
  }
}
