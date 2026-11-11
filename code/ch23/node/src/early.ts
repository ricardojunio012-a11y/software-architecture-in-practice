// Probabilistic early expiration (XFetch). Each request draws whether it recomputes
// the value before it expires. The chance grows as the expiry gets closer, and it
// grows sooner for values that are expensive to generate (higher cost). So, as a
// rule, one request regenerates the value shortly before it expires, and the others
// are never left without it.
export function shouldRecompute(
  now: number,
  expiry: number,
  cost: number,
  beta: number,
  draw: number, // between 0 and 1
): boolean {
  // -ln(draw) is positive and almost always small, sometimes large
  return now - cost * beta * Math.log(draw) >= expiry;
}

// Seeded pseudorandom generator, so the simulation always gives the same result
export function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
