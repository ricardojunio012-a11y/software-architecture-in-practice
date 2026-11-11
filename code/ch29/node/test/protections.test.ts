// The circuit breaker and the retries, with the simulated clock.
import { describe, expect, it } from "vitest";
import { CircuitBreaker, CircuitOpen, withRetries } from "../src/protections.ts";
import { Clock } from "../src/clock.ts";

const failure = async () => {
  throw new Error("503");
};
const success = async () => "ok";

describe("circuit breaker", () => {
  const options = { window: 4, minimum: 4, threshold: 0.75, pauseMs: 1000, probes: 2 };

  it("opens after too many failures and rejects without calling", async () => {
    const b = new CircuitBreaker(new Clock(), options);
    for (let i = 0; i < 4; i++) await b.call(failure).catch(() => {});
    expect(b.state).toBe("open");
    let called = false;
    const spy = async () => {
      called = true;
      return "ok";
    };
    await expect(b.call(spy)).rejects.toBeInstanceOf(CircuitOpen);
    expect(called).toBe(false);
  });

  it("after the pause, successful probes close the circuit breaker", async () => {
    const clock = new Clock();
    const b = new CircuitBreaker(clock, options);
    for (let i = 0; i < 4; i++) await b.call(failure).catch(() => {});
    clock.now = 1000;
    expect(await b.call(success)).toBe("ok");
    expect(b.state).toBe("half-open");
    expect(await b.call(success)).toBe("ok");
    expect(b.state).toBe("closed");
  });
});

describe("retries", () => {
  it("tries again until it works, waiting between attempts", async () => {
    const clock = new Clock();
    let n = 0;
    const unstable = async () => {
      if (++n < 3) throw new Error("503");
      return "ok";
    };
    const result = withRetries(clock, unstable, {
      attempts: 3,
      baseMs: 100,
      random: () => 0.5,
    });
    await clock.run();
    expect(await result).toBe("ok");
    expect(n).toBe(3);
    expect(clock.now).toBe(150); // 50 + 100: half of 100 and half of 200
  });
});
