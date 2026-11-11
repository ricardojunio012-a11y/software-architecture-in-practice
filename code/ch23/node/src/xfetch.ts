// The "xfetch" version: five minutes of requests for the monthly report, which takes
// 2 seconds to generate, with the result valid for 60 seconds. With no protection,
// every request that arrives after the expiry and before the new value is ready also
// generates the report. With probabilistic early expiration (XFetch, by Vattani and
// coauthors), one request regenerates the value shortly before it expires. Time is
// simulated, and the draw is seeded: the result is always the same.
import fs from "node:fs";
import path from "node:path";
import { shouldRecompute, seededRandom } from "./early.ts";

const TTL_S = 60;
const COST_S = 2;
const REQUESTS_PER_S = 10;
const DURATION_S = 300;

function simulate(early: boolean) {
  const draw = seededRandom(2026);
  let expiry = -Infinity; // the cache starts empty
  const generations: number[] = []; // when each generation in progress finishes
  let recomputes = 0;
  let waited = 0;
  for (let i = 0; i < DURATION_S * REQUESTS_PER_S; i++) {
    const now = i / REQUESTS_PER_S;
    // The generations that finished renew the cache
    for (const end of generations.filter((f) => f <= now)) expiry = end + TTL_S;
    generations.splice(0, generations.length, ...generations.filter((f) => f > now));
    const expired = now >= expiry;
    const recompute = early ? shouldRecompute(now, expiry, COST_S, 1, draw()) : expired;
    if (recompute) {
      recomputes++;
      generations.push(now + COST_S);
    }
    if (expired) waited++;
  }
  return { recomputes, waited };
}

const total = (DURATION_S * REQUESTS_PER_S).toLocaleString("en-US");
const lines = [
  `${total} requests in ${DURATION_S} s, ` +
    `TTL of ${TTL_S} s, generation takes ${COST_S} s`,
];
for (const [name, early] of [
  ["fixed expiration", false],
  ["XFetch", true],
] as const) {
  const r = simulate(early);
  lines.push(
    `${name.padEnd(16)} ${r.recomputes} report generations, ` +
      `${r.waited} requests with no valid value in the cache`,
  );
}
const output = path.join(process.argv[2], "output", "xfetch");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
