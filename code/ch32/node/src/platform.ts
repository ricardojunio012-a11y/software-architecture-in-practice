// A simulated function platform, on a logical clock: each call uses a free, "warm"
// execution environment or creates a new one (cold start). Billing follows the AWS
// Lambda model: per request and per GB-second, in milliseconds, with the init phase
// billed since August 2025.
import { PRICES } from "./prices.ts";

// Premises of the lab, not AWS numbers
export const FUNCTION = {
  memoryMb: 1024,
  init: 500, // ms of the cold start: environment, runtime, and your code
  idleTimeout: 5 * 60_000, // ms that an idle environment stays available
};

export type Call = { arrival: number; duration: number }; // ms

export type Execution = { start: number; end: number; cold: boolean; billed: number };

type Environment = { free: number; used: number };

// Runs the calls in order of arrival. With a concurrency limit, a call that finds
// no free slot waits in the queue until an environment finishes.
export function execute(calls: Call[], concurrency = Infinity): Execution[] {
  const environments: Environment[] = [];
  const out: Execution[] = [];
  for (const c of [...calls].sort((a, b) => a.arrival - b.arrival)) {
    // discards the environments idle for longer than the idle timeout
    for (let i = environments.length - 1; i >= 0; i--) {
      const e = environments[i];
      if (e.free <= c.arrival && c.arrival - e.free > FUNCTION.idleTimeout)
        environments.splice(i, 1);
    }
    let start = c.arrival;
    let env = environments
      .filter((e) => e.free <= c.arrival)
      .sort((a, b) => b.free - a.free)[0]; // the most recent: the others cool down
    if (!env && environments.length >= concurrency) {
      env = [...environments].sort((a, b) => a.free - b.free)[0]; // waits for the first
      start = env.free;
    }
    const cold = !env;
    if (!env) {
      env = { free: 0, used: 0 };
      environments.push(env);
    }
    const ms = c.duration + (cold ? FUNCTION.init : 0);
    env.free = start + ms;
    env.used++;
    out.push({ start: c.arrival, end: start + ms, cold, billed: Math.ceil(ms) });
  }
  return out;
}

export function cost(executions: Execution[]) {
  const gbSeconds = executions.reduce(
    (s, e) => s + (e.billed / 1000) * (FUNCTION.memoryMb / 1024),
    0,
  );
  const dollars =
    executions.length * PRICES.lambdaPerRequest + gbSeconds * PRICES.lambdaPerGbSecond;
  return { gbSeconds, dollars };
}
