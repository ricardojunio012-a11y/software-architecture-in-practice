// The "noisy" version: a server handles one request at a time, in order of arrival,
// and each request takes serviceMs. With no limit, one community's burst fills the
// queue and delays everyone. With a token bucket per community, the burst is
// rejected (429) and the others barely wait. Time is simulated, and the result is
// always the same.
import fs from "node:fs";
import path from "node:path";
import { TokenBucket } from "./bucket.ts";

interface Client {
  community: number;
  startMs: number;
  intervalMs: number;
}
interface Request {
  t: number;
  community: number;
}
interface Limit {
  burst: number;
  perSecond: number;
}

const data = process.argv[2];
const scenario = JSON.parse(
  fs.readFileSync(path.join(data, "input", "noisy.json"), "utf8"),
);

const requests: Request[] = [];
for (const c of scenario.clients as Client[]) {
  for (let t = c.startMs; t < scenario.durationMs; t += c.intervalMs) {
    requests.push({ t, community: c.community });
  }
}
requests.sort((a, b) => a.t - b.t || a.community - b.community);

function simulate(limit: Limit | null): string[] {
  const counts = new Map<number, { rejected: number; waits: number[] }>();
  const buckets = new Map<number, TokenBucket>();
  let freeAt = 0;
  for (const r of requests) {
    if (!counts.has(r.community)) counts.set(r.community, { rejected: 0, waits: [] });
    const count = counts.get(r.community)!;
    if (limit) {
      if (!buckets.has(r.community)) {
        buckets.set(r.community, new TokenBucket(limit.burst, limit.perSecond));
      }
      if (!buckets.get(r.community)!.allows(r.t)) {
        count.rejected++;
        continue;
      }
    }
    // The request waits for the server to finish what arrived before it
    const start = Math.max(r.t, freeAt);
    count.waits.push(start - r.t);
    freeAt = start + scenario.serviceMs;
  }
  return [...counts.keys()]
    .sort((a, b) => a - b)
    .map((community) => {
      const { rejected, waits } = counts.get(community)!;
      const sum = waits.reduce((a, b) => a + b, 0);
      const average = waits.length ? Math.floor(sum / waits.length) : 0;
      const max = waits.length ? Math.max(...waits) : 0;
      return (
        `community ${community}: ${waits.length + rejected} requests, ` +
        `${waits.length} served, ${rejected} rejected, ` +
        `average wait ${average} ms, max ${max} ms`
      );
    });
}

const { burst, perSecond } = scenario.limit;
const result = [
  "== no limit",
  ...simulate(null),
  "",
  `== with a per-community limit (burst of ${burst}, ${perSecond} per second)`,
  ...simulate(scenario.limit),
];

const output = path.join(data, "output", "noisy");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), result.join("\n") + "\n");
console.log(`noisy: ${requests.length} requests simulated`);
