// The simulated load: requests arrive at a fixed rate and wait for a free connection.
// The time of each query comes from an assumption, not from a real clock; that is why
// the result is the same on any machine and on every run.

// Seeded pseudorandom generator (mulberry32)
export function generator(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The lab's assumptions, not measurements
export const ASSUMPTIONS = {
  msPerQuery: 0.8, // round trip to the database, over an open connection
  msPerRow: 0.004,
  tailChance: 0.02, // 2% of the queries take 4 times longer
};

// Duration of a request: the sum of its queries, each with a random variation
export function duration(rowsPerQuery: number[], draw: () => number): number {
  let ms = 0;
  for (const rows of rowsPerQuery) {
    const base = ASSUMPTIONS.msPerQuery + ASSUMPTIONS.msPerRow * rows;
    const variation = 0.75 + 0.5 * draw();
    ms += base * variation * (draw() < ASSUMPTIONS.tailChance ? 4 : 1);
  }
  return ms;
}

// Queue with several connections: each request takes the first one that is free
export function simulate(arrivals: number[], durations: number[], connections: number) {
  const freeAt = new Array<number>(connections).fill(0);
  return arrivals.map((arrival, i) => {
    const c = freeAt.indexOf(Math.min(...freeAt));
    const start = Math.max(arrival, freeAt[c]);
    freeAt[c] = start + durations[i];
    return freeAt[c] - arrival; // latency: wait in the queue plus duration
  });
}

// Percentile by the nearest-rank method
export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}
