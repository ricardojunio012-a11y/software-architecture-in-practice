// The "algorithms" version: the same sequence of requests spread across three servers
// by four algorithms. Request durations vary (most short, a few long), and the third
// server is twice as slow, from an older generation of machines. Time is simulated.
import fs from "node:fs";
import path from "node:path";
import {
  type Algorithm,
  keyHash,
  leastConnections,
  roundRobin,
  type Server,
  seededRandom,
  twoChoices,
} from "./balancing.ts";

const REQUESTS = 20_000;
const INTERVAL_MS = 5; // 200 requests per second
const SLOWNESS = [1, 1, 2];

// The same load for all: base duration and community of each request
const random = seededRandom(42);
const load = Array.from({ length: REQUESTS }, () => ({
  duration: random() < 0.9 ? 5 + random() * 5 : 40 + random() * 40,
  // A few large communities account for many requests
  community: random() < 0.3 ? 7 : Math.floor(random() * 500),
}));

function simulate(algorithm: Algorithm) {
  const servers: Server[] = SLOWNESS.map(() => ({ inFlight: 0 }));
  const finishes: number[][] = SLOWNESS.map(() => []);
  const times: number[] = [];
  const algorithmRandom = seededRandom(7);
  load.forEach((r, i) => {
    const now = i * INTERVAL_MS;
    // Release the requests that have already finished
    finishes.forEach((list, s) => {
      const pending = list.filter((t) => t > now);
      servers[s].inFlight = pending.length;
      finishes[s] = pending;
    });
    const s = algorithm(servers, r.community, algorithmRandom);
    // Each server splits its capacity among the requests in flight
    const duration = r.duration * SLOWNESS[s] * (1 + servers[s].inFlight * 0.5);
    finishes[s].push(now + duration);
    times.push(duration);
  });
  times.sort((a, b) => a - b);
  const pct = (q: number) => times[Math.floor(q * (times.length - 1))].toFixed(0);
  return `median ${pct(0.5)} ms, p99 ${pct(0.99)} ms`;
}

const lines = [
  `${REQUESTS.toLocaleString("en-US")} requests, 3 servers (the third twice as slow)`,
  `round robin:                ${simulate(roundRobin)}`,
  `least connections:          ${simulate(leastConnections)}`,
  `two random choices:         ${simulate(twoChoices)}`,
  `community hash:             ${simulate(keyHash)}`,
];
const output = path.join(process.argv[2], "output", "algorithms");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
