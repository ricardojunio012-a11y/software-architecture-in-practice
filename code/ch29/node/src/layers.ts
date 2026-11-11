// The "layers" version: 100 payments go through three layers (app, Morada API,
// billing service) to a gateway that is down. When each layer makes its own 3
// attempts, the calls multiply.
import fs from "node:fs";
import path from "node:path";
import { type Call, RetryBudget, withRetries } from "./protections.ts";
import { Clock, seededRandom } from "./clock.ts";

const data = process.argv[2];

async function scenario(attemptsPerLayer: number[], withBudget: boolean) {
  const clock = new Clock();
  const random = seededRandom(3);
  let calls = 0;
  const gateway = async () => {
    calls++;
    await clock.sleep(20);
    throw new Error("503");
  };
  // Each layer has its own budget, as each process would
  const budgets = attemptsPerLayer.map(() => new RetryBudget(0.1, 10));
  // The innermost layer calls the gateway; each one wraps the one inside it
  let call: Call<never> = gateway;
  attemptsPerLayer.forEach((attempts, i) => {
    const inner = call;
    call = () =>
      withRetries(clock, inner, {
        attempts,
        baseMs: 100,
        random,
        budget: withBudget ? budgets[i] : undefined,
      });
  });
  const requests = Array.from({ length: 100 }, async (_, k) => {
    await clock.sleep(k * 50);
    await call().catch(() => {});
  });
  await clock.run();
  await Promise.all(requests);
  return calls;
}

const cases: [string, number[], boolean][] = [
  ["3 attempts in every layer", [3, 3, 3], false],
  ["3 attempts in the billing layer only", [3, 1, 1], false],
  ["3 in every layer, with a 10% budget", [3, 3, 3], true],
];
const lines = [
  "100 payments, gateway down, three layers between the resident and the gateway",
];
for (const [name, attempts, withBudget] of cases) {
  const n = await scenario(attempts, withBudget);
  lines.push(`  ${name.padEnd(40)}${String(n).padStart(5)} calls`);
}

const output = path.join(data, "output", "layers");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
