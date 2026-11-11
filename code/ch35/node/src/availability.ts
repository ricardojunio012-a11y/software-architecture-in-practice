// The composite availability math of section 35.1.

// All must work: the availabilities multiply
export const inSeries = (ps: number[]) => ps.reduce((a, p) => a * p, 1);

// One working is enough, and failures are independent: the unavailabilities
// multiply
export const inParallel = (ps: number[]) => 1 - ps.reduce((a, p) => a * (1 - p), 1);

// Replicas in parallel that depend on something shared (the same zone, the same
// database): the shared component is in series with the set
export const withShared = (shared: number, replicas: number[]) =>
  inSeries([shared, inParallel(replicas)]);

export const hoursDownPerYear = (p: number) => (1 - p) * 365 * 24;

export const percent = (p: number, places = 2) => `${(p * 100).toFixed(places)}%`;
