// The scenario: six seconds of traffic on Morada, with 20 payments and 50 notice
// lookups per second, on a server with 16 workers. Notices do not depend on the
// payment gateway; payments do.
import {
  Bulkhead,
  CircuitBreaker,
  withRetries,
  withTimeout,
  Workers,
} from "./protections.ts";
import { Clock, seededRandom } from "./clock.ts";

export interface Protections {
  timeoutMs?: number;
  attempts?: number;
  breaker?: boolean;
  bulkhead?: number;
}

export interface Result {
  fastNotices: number; // answered within 200 ms
  longestNoticeWait: number;
  paymentsConfirmed: number;
  gatewayCalls: number;
}

export const NOTICES = 300;
export const PAYMENTS = 120;

export async function simulate(p: Protections): Promise<Result> {
  const clock = new Clock();
  const randomFailure = seededRandom(2029);
  const randomBackoff = seededRandom(7);
  let gatewayCalls = 0;
  const charged = new Set<string>();

  // The gateway: normal until 1 s; down until 4 s (no response for 5 s); then
  // unstable, with half the calls failing at once. Like a real gateway, it is
  // idempotent by key: a key already charged returns "approved" without charging
  // again. In this scenario's failures, the gateway never gets to charge; on a real
  // timeout, it may have charged, and the key is what makes the retry safe.
  async function gateway(key: string): Promise<string> {
    gatewayCalls++;
    if (charged.has(key)) return "approved";
    const t = clock.now;
    if (t >= 1000 && t < 4000) {
      await clock.sleep(5000);
      throw new Error("no response");
    }
    if (t >= 4000 && randomFailure() < 0.5) {
      await clock.sleep(20);
      throw new Error("503");
    }
    await clock.sleep(50);
    charged.add(key);
    return "approved";
  }

  // The protections, from the inside out: timeout, circuit breaker, retries, and
  // bulkhead
  const breaker = p.breaker
    ? new CircuitBreaker(clock, {
        window: 20,
        minimum: 10,
        threshold: 0.8,
        pauseMs: 1000,
        probes: 4,
      })
    : null;
  const bulkhead = p.bulkhead ? new Bulkhead(p.bulkhead) : null;
  // The idempotency key is created once per payment and goes with every attempt
  const timed = (key: string) =>
    p.timeoutMs ? withTimeout(clock, p.timeoutMs, () => gateway(key)) : gateway(key);
  const oneAttempt = (key: string) =>
    breaker ? breaker.call(() => timed(key)) : timed(key);
  const charge = (key: string) =>
    withRetries(clock, () => oneAttempt(key), {
      attempts: p.attempts ?? 1,
      baseMs: 100,
      random: randomBackoff,
    });
  const pay = (key: string) =>
    bulkhead ? bulkhead.call(() => charge(key)) : charge(key);

  const server = new Workers(16);
  const waits: number[] = [];
  let confirmed = 0;
  async function arrive(kind: "notice" | "payment", at: number) {
    await clock.sleep(at);
    const arrival = clock.now;
    await server.run(async () => {
      await clock.sleep(5); // Morada's own work
      if (kind === "payment") {
        try {
          await pay(`payment-${at}`);
          confirmed++;
        } catch {
          // the resident sees "we could not take your payment right now"
        }
      }
    });
    if (kind === "notice") waits.push(clock.now - arrival);
  }

  const requests: Promise<void>[] = [];
  for (let t = 0; t < 6000; t += 50) requests.push(arrive("payment", t));
  for (let t = 0; t < 6000; t += 20) requests.push(arrive("notice", t));
  await clock.run();
  await Promise.all(requests);
  return {
    fastNotices: waits.filter((w) => w <= 200).length,
    longestNoticeWait: Math.max(...waits),
    paymentsConfirmed: confirmed,
    gatewayCalls,
  };
}
