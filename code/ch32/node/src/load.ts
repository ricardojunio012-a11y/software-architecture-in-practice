// The load on the Morada API, in requests per second, every 15 s. These are
// premises of the lab, not measurements: an ordinary day, the days around the due
// date, and the 5th, when the "your dues are due today" reminder goes out at 8 a.m.
// to the residents of 3,000 communities.
export const STEP = 15; // seconds between two measurements (the HPA cycle)
export const PER_DAY = (24 * 3600) / STEP;

// Requests per second on an ordinary day, hour by hour (midnight to 11 p.m.)
const ORDINARY_DAY = [
  15, 12, 10, 10, 12, 20, 40, 90, 160, 170, 165, 160, 130, 130, 150, 155, 150, 150, 170,
  175, 165, 130, 90, 40,
];

// How much each day of the month weighs compared with the ordinary day
export function dayFactor(day: number): number {
  if (day >= 1 && day <= 4) return 1.3;
  if (day === 5) return 1.6;
  if (day >= 6 && day <= 10) return 1.5 - (day - 6) * 0.1;
  return 1;
}

// Seeded pseudorandom generator (mulberry32): the same draw on every run
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

// The day-5 reminder: it reaches every phone within 30 s, starting at 8 a.m., and
// its effect halves every 40 minutes
export function reminder(seconds: number): number {
  const since = seconds - 8 * 3600;
  if (since < 0) return 0;
  const rise = Math.min(1, since / 30);
  return 500 * rise * Math.pow(0.5, since / 2400);
}

// The load of one day, every STEP seconds, with a random ±5% variation
export function dayLoad(day: number, draw: () => number): number[] {
  const load: number[] = [];
  for (let k = 0; k < PER_DAY; k++) {
    const s = k * STEP;
    const h = s / 3600;
    const a = ORDINARY_DAY[Math.floor(h)];
    const b = ORDINARY_DAY[(Math.floor(h) + 1) % 24];
    const base = a + (b - a) * (h - Math.floor(h)); // interpolates between the hours
    const extra = day === 5 ? reminder(s) : 0;
    const variation = 0.95 + 0.1 * draw();
    load.push(Math.round((base * dayFactor(day) + extra) * variation));
  }
  return load;
}

// The whole month (30 days), day after day, with a single seed
export function monthLoad(seed: number): number[] {
  const draw = generator(seed);
  const month: number[] = [];
  for (let day = 1; day <= 30; day++) month.push(...dayLoad(day, draw));
  return month;
}
