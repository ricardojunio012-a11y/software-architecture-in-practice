// The chapter's protections, each independent of the others: timeout, retries with
// jitter, circuit breaker, and bulkhead. All of them use the simulated clock.
import type { Clock } from "./clock.ts";

export type Call<T> = () => Promise<T>;
export class CircuitOpen extends Error {}
export class BulkheadFull extends Error {}

// Timeout: gives up after `ms`. The call goes on out there, but whoever was waiting
// is free
export function withTimeout<T>(clock: Clock, ms: number, call: Call<T>) {
  return Promise.race([
    call(),
    clock.sleep(ms).then((): T => {
      throw new Error("timeout");
    }),
  ]);
}

// Retry budget: each new request deposits a fraction of a token, each retry spends
// one. With 0.1, retries stay close to 10% of the requests
export class RetryBudget {
  tokens: number;
  deposit: number;
  max: number;

  constructor(deposit: number, max: number) {
    this.deposit = deposit;
    this.max = max;
    this.tokens = max;
  }

  newRequest() {
    this.tokens = Math.min(this.max, this.tokens + this.deposit);
  }

  canRetry(): boolean {
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

export interface RetryOptions {
  attempts: number;
  baseMs: number;
  random: () => number;
  budget?: RetryBudget;
}

// Retries with exponential backoff and full jitter: before attempt n + 1, waits a
// random time between 0 and base × 2^(n-1)
export async function withRetries<T>(
  clock: Clock,
  call: Call<T>,
  o: RetryOptions,
): Promise<T> {
  o.budget?.newRequest();
  for (let n = 1; ; n++) {
    try {
      return await call();
    } catch (error) {
      const giveUp =
        n >= o.attempts ||
        error instanceof CircuitOpen ||
        (o.budget !== undefined && !o.budget.canRetry());
      if (giveUp) throw error;
      await clock.sleep(Math.floor(o.random() * o.baseMs * 2 ** (n - 1)));
    }
  }
}

export interface BreakerOptions {
  window: number; // how many recent calls to watch
  minimum: number; // how many it must have seen to decide
  threshold: number; // share of failures that opens the circuit breaker
  pauseMs: number; // how long it stays open before probing
  probes: number; // how many probe calls it lets through when half-open
}

// Circuit breaker: if the share of failures in the last calls reaches the threshold,
// it opens and rejects at once during the pause. Then it goes half-open: it lets a few
// probe calls through and, depending on their result, closes or opens again
export class CircuitBreaker {
  state: "closed" | "open" | "half-open" = "closed";
  openings = 0;
  clock: Clock;
  o: BreakerOptions;
  #results: boolean[] = [];
  #openedAt = 0;
  #probesInFlight = 0;

  constructor(clock: Clock, o: BreakerOptions) {
    this.clock = clock;
    this.o = o;
  }

  async call<T>(call: Call<T>): Promise<T> {
    if (this.state === "open") {
      if (this.clock.now - this.#openedAt < this.o.pauseMs) {
        throw new CircuitOpen("circuit open");
      }
      this.state = "half-open";
    }
    const probe = this.state === "half-open";
    if (probe) {
      if (this.#probesInFlight + this.#results.length >= this.o.probes) {
        throw new CircuitOpen("circuit half-open, probing");
      }
      this.#probesInFlight++;
    }
    try {
      const response = await call();
      this.#record(true, probe);
      return response;
    } catch (error) {
      this.#record(false, probe);
      throw error;
    }
  }

  #record(success: boolean, probe: boolean) {
    if (probe) this.#probesInFlight--;
    // Late responses from before the opening do not count
    if (this.state === "open" || (this.state === "half-open" && !probe)) return;
    this.#results.push(success);
    if (this.#results.length > this.o.window) this.#results.shift();
    const seen = this.#results.length;
    const share = this.#results.filter((r) => !r).length / seen;
    if (this.state === "half-open") {
      if (seen < this.o.probes) return;
      if (share >= this.o.threshold) this.#open();
      else {
        this.state = "closed";
        this.#results = [];
      }
    } else if (seen >= this.o.minimum && share >= this.o.threshold) this.#open();
  }

  #open() {
    this.state = "open";
    this.#openedAt = this.clock.now;
    this.#results = [];
    this.openings++;
  }
}

// Bulkhead: at most `slots` calls at the same time; the next one is rejected at once,
// instead of holding one more server worker
export class Bulkhead {
  slots: number;
  rejections = 0;
  #busy = 0;

  constructor(slots: number) {
    this.slots = slots;
  }

  async call<T>(call: Call<T>): Promise<T> {
    if (this.#busy >= this.slots) {
      this.rejections++;
      throw new BulkheadFull("bulkhead full");
    }
    this.#busy++;
    try {
      return await call();
    } finally {
      this.#busy--;
    }
  }
}

// The server workers: at most `n` requests served at the same time; the others wait
// in line, in order of arrival
export class Workers {
  #free: number;
  #queue: (() => void)[] = [];

  constructor(n: number) {
    this.#free = n;
  }

  async run<T>(task: Call<T>): Promise<T> {
    if (this.#free > 0) this.#free--;
    else await new Promise<void>((turn) => this.#queue.push(turn));
    try {
      return await task();
    } finally {
      const next = this.#queue.shift();
      if (next) next();
      else this.#free++;
    }
  }
}
