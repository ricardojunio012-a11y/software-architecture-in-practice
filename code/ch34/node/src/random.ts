// Seeded pseudorandom generator (mulberry32): the same draws on every run
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

// A duration with a long tail: most near the median, a few much slower
export function duration(draw: () => number, median: number): number {
  const u = Math.max(draw(), 1e-9);
  return Math.round(median * Math.exp(0.5 * Math.sqrt(-2 * Math.log(u)) - 0.6));
}
